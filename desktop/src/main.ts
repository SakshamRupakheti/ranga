import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  session,
  screen,
  shell,
  WebContentsView,
} from "electron";
import type { IpcMainEvent, WebContents, Session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import {
  recordDownload,
  readCompletedDownload,
  type CompletedDownload,
} from "./download-handoff";
import {
  allowedNavigation,
  externalUrl,
  isCommand,
  isSite,
  isMode,
  normalizeQuery,
  pinterestSearchUrl,
  projectKey,
  validContext,
  discoveryPrompt,
  originLabel,
  paneBounds,
  referenceTrayBounds,
  rangaUrl,
  type Command,
  type Site,
  type WorkspaceState,
  type Mode,
  type ProjectContext,
} from "./policy";

app.setName("Ranga Workspace");
// Tests and portable development runs can select an isolated profile. This never
// imports cookies or storage from an existing browser.
const profileDirectory =
  process.env.RANGA_DESKTOP_PROFILE ??
  (!app.isPackaged ? path.join(__dirname, "../.profiles/local") : undefined);
if (profileDirectory) {
  const profile = path.resolve(profileDirectory);
  mkdirSync(profile, { recursive: true });
  app.setPath("userData", profile);
}

const localUrl = rangaUrl(process.env.RANGA_DESKTOP_URL);
const homeUrls: Record<Site, string> = {
  ranga: localUrl,
  chatgpt: "https://chatgpt.com/",
  pinterest: "https://www.pinterest.com/",
};
const names: Record<Site, string> = {
  ranga: "Ranga",
  chatgpt: "ChatGPT",
  pinterest: "Pinterest",
};
const toolbarPath = path.join(__dirname, "../ui/index.html");
const toolbarUrl = pathToFileURL(toolbarPath).href;
const securePreferences = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  webviewTag: false,
  allowRunningInsecureContent: false,
  navigateOnDragDrop: false,
};

let window: BrowserWindow | undefined;
const views = new Map<Site, WebContentsView>();
const popups = new Set<BrowserWindow>();
const configuredSessions = new Set<Session>();
const failures = new Map<Site, string>();
let selected: Site = "ranga";
let focused: Site = "ranga";
let split = false;
let mode: Mode = "focus";
let query = "";
let context: ProjectContext | undefined;
let promptOpen = false;
let referenceTrayOpen = false;
let ratio = 0.5;
let swapped = false;
let pendingSearch = "";
let externalOpened = false;
let message =
  "Describe a design to search Pinterest and prepare a ChatGPT prompt.";
let pendingLink: string | undefined;
let pendingDownload: { file: CompletedDownload; key: string } | undefined;
let downloadBusy = false;
let downloadEpoch = 0;

function pageStatus(site: Site): string {
  const contents = views.get(site)?.webContents;
  if (!contents || contents.isDestroyed()) return "Not opened";
  if (failures.has(site)) return "Unavailable";
  if (contents.isLoading()) return "Loading";
  const url = contents.getURL();
  if (!url) return "Not opened";
  const parsed = new URL(url);
  if (
    /\/(login|signin|sign-in|auth)(\/|$)/i.test(parsed.pathname) ||
    /^(accounts\.|auth\.|login\.|appleid\.)/.test(parsed.hostname)
  )
    return "Sign-in page";
  return "Page loaded";
}

function publish() {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed())
    return;
  const contents = views.get(focused)?.webContents;
  const ready = contents && !contents.isDestroyed();
  const state: WorkspaceState = {
    selected,
    focused,
    split,
    origin: originLabel(
      ready ? contents.getURL() || homeUrls[focused] : homeUrls[focused],
    ),
    loading: ready ? contents.isLoading() : false,
    back: ready ? contents.navigationHistory.canGoBack() : false,
    forward: ready ? contents.navigationHistory.canGoForward() : false,
    message: message || failures.get(focused) || "",
    hasLink: Boolean(pendingLink),
    mode,
    query,
    projectKey: context?.key ?? null,
    projectName: context?.name ?? "No project open",
    editable: context?.editable ?? false,
    prompt: discoveryPrompt(query, context),
    promptOpen,
    referenceTrayOpen: mode === "discover" && referenceTrayOpen,
    downloadName:
      pendingDownload?.key === context?.key
        ? (pendingDownload?.file.name ?? "")
        : "",
    downloadBusy,
    ratio,
    pages: {
      ranga: pageStatus("ranga"),
      chatgpt: pageStatus("chatgpt"),
      pinterest: pageStatus("pinterest"),
    },
  };
  window.webContents.send("workspace:state", state);
}

function suggestExternal(url: string, site: Site) {
  pendingLink = externalUrl(url, site === "ranga" ? localUrl : undefined);
  message = pendingLink
    ? `Open ${originLabel(pendingLink)} in your system browser?`
    : "This address cannot open in the workspace. Choose a site above to continue.";
  publish();
}

function configureSession(ses: Session, site: Site) {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  // OS paste gestures and file pickers still work. No silent clipboard reads,
  // camera, microphone, location, notifications or device access.
  ses.setPermissionCheckHandler(
    (_contents, permission) => permission === "clipboard-sanitized-write",
  );
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    const allowed = permission === "clipboard-sanitized-write";
    callback(allowed);
    if (!allowed && focused === site) {
      message = permission.includes("clipboard")
        ? "Use Ctrl/Cmd+V or Upload for images. Clipboard reads are available in your system browser."
        : `${names[site]} requested a browser permission. Use Open in browser for this feature.`;
      publish();
    }
  });
  ses.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({ title: "Save a file from Ranga Workspace" });
    // No setSavePath: Chromium asks the user where to save. Never auto-open files.
    if (site === "ranga") return;
    const key = context?.editable ? context.key : undefined;
    const epoch = downloadEpoch;
    item.once("done", (_event, state) => {
      if (!key || epoch !== downloadEpoch || context?.key !== key) return;
      if (state !== "completed") {
        message =
          state === "cancelled"
            ? "Download cancelled. No result was imported."
            : "Download interrupted. Try the download again or choose a saved file in Ranga.";
        publish();
        return;
      }
      void recordDownload(item.getSavePath())
        .then((file) => {
          if (
            epoch !== downloadEpoch ||
            context?.key !== key ||
            !context.editable
          )
            return;
          pendingDownload = { file, key };
          message = `Saved ${file.name}. Choose Import download to send it to Ranga for review.`;
          publish();
        })
        .catch((error) => {
          if (epoch !== downloadEpoch || context?.key !== key) return;
          message =
            error instanceof Error
              ? error.message
              : "The file was saved. Choose it in Ranga to preview it.";
          publish();
        });
    });
  });
}

function clearDownload() {
  downloadEpoch++;
  pendingDownload = undefined;
}

async function importDownload() {
  const record = pendingDownload,
    epoch = downloadEpoch;
  if (!record || downloadBusy) return;
  if (
    context?.key !== record.key ||
    !context.editable ||
    projectKey(views.get("ranga")?.webContents.getURL() ?? "", localUrl) !==
      record.key
  ) {
    clearDownload();
    publish();
    return;
  }
  downloadBusy = true;
  publish();
  try {
    const file = await readCompletedDownload(record.file);
    if (
      epoch !== downloadEpoch ||
      pendingDownload !== record ||
      context?.key !== record.key ||
      !context.editable
    )
      return;
    setMode("design");
    views
      .get("ranga")
      ?.webContents.send("ranga:discovery", {
        type: "download",
        key: record.key,
        file,
      });
    clearDownload();
    message =
      "File sent to Ranga. Preview it, confirm image permission if needed, then apply it when ready.";
  } catch {
    if (epoch === downloadEpoch) {
      clearDownload();
      message =
        "The saved download is unavailable or changed. Use Choose file in Ranga to preview it again.";
    }
  } finally {
    downloadBusy = false;
    publish();
  }
}

function protectContents(contents: WebContents, site: Site, popup = false) {
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("will-navigate", (event) => {
    if (!allowedNavigation(site, event.url, localUrl)) {
      event.preventDefault();
      suggestExternal(event.url, site);
    }
  });
  contents.on("will-redirect", (event) => {
    if (event.isMainFrame && !allowedNavigation(site, event.url, localUrl)) {
      event.preventDefault();
      suggestExternal(event.url, site);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (!allowedNavigation(site, url, localUrl) || popups.size >= 4) {
      suggestExternal(url, site);
      return { action: "deny" };
    }
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 900,
        height: 760,
        autoHideMenuBar: true,
        title: `${names[site]} · ${originLabel(url)}`,
        webPreferences: {
          ...securePreferences,
          session: contents.session,
          preload: undefined,
        },
      },
    };
  });
  contents.on("did-create-window", (child) => {
    popups.add(child);
    child.on("closed", () => popups.delete(child));
    child.webContents.on("page-title-updated", (event) =>
      event.preventDefault(),
    );
    child.webContents.on("did-navigate", () => {
      child.setTitle(
        `${names[site]} · ${originLabel(child.webContents.getURL())}`,
      );
    });
    protectContents(child.webContents, site, true);
  });
  if (popup) return;
  contents.on("focus", () => {
    focused = site;
    publish();
  });
  contents.on("did-start-loading", publish);
  contents.on("did-stop-loading", publish);
  contents.on("did-navigate", publish);
  contents.on("did-navigate-in-page", publish);
  if (site === "ranga") {
    const clearStaleContext = () => {
      if (context && context.key !== projectKey(contents.getURL(), localUrl)) {
        context = undefined;
        query = "";
        clearDownload();
        publish();
      }
    };
    contents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) {
        clearDownload();
        context = undefined;
        query = "";
        publish();
      }
    });
    contents.on("did-navigate-in-page", clearStaleContext);
  }
  contents.on("did-finish-load", () => {
    failures.delete(site);
    if (site === "pinterest") pendingSearch = "";
    publish();
  });
  contents.on(
    "did-fail-load",
    (_event, code, _description, failedUrl, isMainFrame) => {
      if (!isMainFrame || code === -3) return;
      const failure =
        site === "ranga"
          ? "Ranga is offline. Start the web app on port 3001, then press Reload. See Help for the commands."
          : `${names[site]} could not load. Try Reload or Open in browser; sign-in may require a regular browser.`;
      failures.set(site, failure);
      if (focused === site) message = failure;
      if (
        site === "pinterest" &&
        pendingSearch &&
        failedUrl === pendingSearch
      ) {
        pendingSearch = "";
        message =
          "Pinterest search could not load. Opening Pinterest home. Copy the query and paste it there, or use Open in browser.";
        void contents.loadURL(homeUrls.pinterest).catch(() => {});
      }
      publish();
    },
  );
  contents.on("render-process-gone", () => {
    if (site === "ranga") {
      clearDownload();
      context = undefined;
      query = "";
    }
    failures.set(
      site,
      `${names[site]} stopped responding. Press Reload to reopen it.`,
    );
    message = "";
    publish();
  });
}

function ensureView(site: Site, initialUrl = homeUrls[site]) {
  let view = views.get(site);
  if (view) return view;
  const ses = session.fromPartition(`persist:ranga-workspace-${site}`);
  configureSession(ses, site);
  view = new WebContentsView({
    webPreferences: {
      ...securePreferences,
      session: ses,
      ...(site === "ranga"
        ? { preload: path.join(__dirname, "ranga-preload.js") }
        : {}),
    },
  });
  views.set(site, view);
  view.setBackgroundColor("#faf8f2");
  protectContents(view.webContents, site);
  window!.contentView.addChildView(view);
  void view.webContents.loadURL(initialUrl).catch(() => {
    /* did-fail-load reports it */
  });
  return view;
}

function syncReferenceLayout() {
  if (context)
    views.get("ranga")?.webContents.send("ranga:discovery", {
      type: "layout",
      key: context.key,
      referenceOnly: mode === "discover" && referenceTrayOpen,
    });
}

function layout() {
  if (!window || window.isDestroyed()) return;
  const visible: Site[] =
    mode === "discover"
      ? ["pinterest", "chatgpt"]
      : split && selected !== "ranga"
        ? ["ranga", selected]
        : [selected];
  if (swapped && visible.length === 2) visible.reverse();
  const [width, height] = window.getContentSize();
  const tray =
    mode === "discover" && referenceTrayOpen
      ? referenceTrayBounds(width, height)
      : undefined;
  const bounds = paneBounds(
    width,
    height,
    visible.length === 2,
    ratio,
    tray ? tray.height + 2 : promptOpen ? 240 : 0,
  );
  visible.forEach((site) => ensureView(site));
  for (const [site, view] of views) {
    const index = visible.indexOf(site);
    view.setVisible(index >= 0 || (site === "ranga" && !!tray));
    if (site === "ranga" && tray) view.setBounds(tray);
    else if (index >= 0) view.setBounds(bounds[index]);
  }
  syncReferenceLayout();
  publish();
}

function select(site: Site) {
  if (mode === "discover") {
    split = false;
    mode = "focus";
  }
  selected = site;
  focused = site;
  if (site === "ranga") split = false;
  if (!split) mode = "focus";
  message = "";
  pendingLink = undefined;
  layout();
  views.get(site)?.webContents.focus();
}

function setMode(next: Mode) {
  mode = next;
  split = next !== "focus";
  selected =
    next === "discover" ? "pinterest" : next === "design" ? "chatgpt" : "ranga";
  focused = next === "design" ? "ranga" : selected;
  if (next === "focus") promptOpen = false;
  message = "";
  pendingLink = undefined;
  layout();
  views.get(focused)?.webContents.focus();
}

function search(value: unknown, key: unknown) {
  try {
    if (key !== (context?.key ?? null))
      throw new Error(
        "The active project changed. Review the query and search again.",
      );
    query = normalizeQuery(value);
    const target = pinterestSearchUrl(query);
    pendingSearch = target;
    failures.delete("pinterest");
    const existing = views.get("pinterest");
    if (existing) void existing.webContents.loadURL(target).catch(() => {});
    else ensureView("pinterest", target);
    if (context?.editable)
      views.get("ranga")?.webContents.send("ranga:discovery", {
        type: "query",
        key: context.key,
        query,
      });
    setMode("discover");
    message =
      context?.prompt === null
        ? "This project's prompt is too large for the toolbar. Copy the full instructions from Ranga's Creative tools or References."
        : context && !context.editable
          ? "Prompt ready. Read-only project: this query stays in this session. Paste and send in ChatGPT yourself."
          : "Prompt ready. Copy it when you choose, then paste and send in ChatGPT. Sign in if either site asks.";
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Search could not start.";
  }
  publish();
}

function focusChatGPT() {
  if (mode !== "discover") setMode("design");
  focused = "chatgpt";
  views.get("chatgpt")?.webContents.focus();
  publish();
}

function copyText(value: string, confirmation: string) {
  if (!value) {
    message = "Enter a query or open a project first.";
    return false;
  }
  try {
    clipboard.writeText(value);
    message = confirmation;
    return true;
  } catch {
    promptOpen = true;
    referenceTrayOpen = false;
    message =
      "Clipboard is unavailable. Select and copy the text in the prompt panel.";
    layout();
    return false;
  }
}

async function openInBrowser(url: string | undefined) {
  if (!url) return;
  try {
    await shell.openExternal(url);
    externalOpened = true;
    message =
      "Opened in your browser. Return here when ready; website sessions remain separate.";
    publish();
  } catch {
    message =
      "The system browser could not open. Try again or open the website manually.";
    publish();
  }
}

function runCommand(command: Command) {
  const contents = views.get(focused)?.webContents;
  if (contents?.isDestroyed()) return;
  switch (command) {
    case "back":
      if (contents?.navigationHistory.canGoBack())
        contents.navigationHistory.goBack();
      break;
    case "forward":
      if (contents?.navigationHistory.canGoForward())
        contents.navigationHistory.goForward();
      break;
    case "home":
    case "reload":
      message = "";
      failures.delete(focused);
      if (command === "home" || !contents?.getURL()) {
        void contents?.loadURL(homeUrls[focused]).catch(() => {});
      } else contents.reload();
      break;
    case "split":
      if (mode === "discover") {
        setMode("design");
        break;
      }
      split = !split;
      mode = split ? "design" : "focus";
      if (split && selected === "ranga") selected = "chatgpt";
      focused = selected;
      message = "";
      layout();
      views.get(selected)?.webContents.focus();
      break;
    case "prompt":
      promptOpen = !promptOpen;
      if (promptOpen) referenceTrayOpen = false;
      layout();
      break;
    case "copy-prompt":
      if (
        copyText(
          discoveryPrompt(query, context),
          "Prompt copied. Paste and send it in ChatGPT yourself.",
        )
      ) {
        const confirmation = message;
        focusChatGPT();
        message = confirmation;
      }
      break;
    case "copy-query":
      copyText(query, "Query copied. Paste it into Pinterest's search box.");
      break;
    case "retry-search":
      search(query, context?.key ?? null);
      break;
    case "swap":
      swapped = !swapped;
      layout();
      break;
    case "references":
      if (context) {
        views.get("ranga")?.webContents.send("ranga:discovery", {
          type: "references",
          key: context.key,
        });
        if (mode === "discover") {
          referenceTrayOpen = !referenceTrayOpen;
          if (referenceTrayOpen) promptOpen = false;
          layout();
          focused = referenceTrayOpen ? "ranga" : "pinterest";
          views.get(focused)?.webContents.focus();
        } else {
          // The same board is available beside the canvas in Design mode.
          focused = "ranga";
          if (mode === "focus" && selected !== "ranga") setMode("focus");
          views.get("ranga")?.webContents.focus();
        }
      } else {
        setMode("focus");
        message = "Open a project to use its existing reference board.";
      }
      break;
    case "external":
      // Open the site's landing page: local session tokens and OAuth URLs must
      // not be carried into another browser profile.
      void openInBrowser(
        externalUrl(
          homeUrls[focused],
          focused === "ranga" ? localUrl : undefined,
        ),
      );
      break;
    case "bring":
      if (context) {
        setMode("design");
        views.get("ranga")?.webContents.send("ranga:discovery", {
          type: "bring",
          key: context.key,
        });
        message = context.editable
          ? "Paste or choose a result in Ranga, then review its preview."
          : "This project is read-only. Choose an editable project to import a result.";
      } else {
        setMode("focus");
        message = "Open a Ranga project before bringing in a result.";
      }
      break;
    case "import-download":
      void importDownload();
      break;
    case "dismiss-download":
      clearDownload();
      message = "Download handoff dismissed. Your saved file stays on disk.";
      break;
    case "open-link": {
      const url = pendingLink;
      pendingLink = undefined;
      message = "";
      void openInBrowser(url);
      break;
    }
    case "dismiss":
      pendingLink = undefined;
      message = "";
      break;
    case "help":
      if (window)
        void dialog.showMessageBox(window, {
          type: "info",
          title: "Ranga Workspace",
          message: "Your creative tools, side by side.",
          detail:
            "Start Ranga in two terminals from the repository folder:\n\nnpm run service\nnpm run dev -- --port 3001\n\nSearch sends only your query to Pinterest and prepares a local prompt. Discover shows Pinterest and ChatGPT; Design pairs Ranga with ChatGPT; Focus expands Ranga. Review the prompt, then Copy & ChatGPT. Paste and send yourself. Use References to return to the existing project board.\n\nIf Pinterest search fails, use Site home and Copy query, then search manually. Page loaded does not mean signed in. Sign in yourself; if the provider rejects this browser, select its pane and Open in browser. That opens the site's home page without transferring sessions or sign-in URLs.\n\nDesktop sessions are separate from Chrome/Edge. Export a JSON backup to move local work here, or sign into Ranga for shared projects. No third-party APIs, automated messages, clipboard monitoring, or remote content capture.",
        });
      break;
  }
  publish();
}

function trusted(event: IpcMainEvent) {
  return Boolean(
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === toolbarUrl,
  );
}

function trustedRanga(event: IpcMainEvent) {
  const contents = views.get("ranga")?.webContents;
  return Boolean(
    contents &&
    !contents.isDestroyed() &&
    event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    projectKey(event.senderFrame.url, localUrl),
  );
}

ipcMain.on("ranga:context", (event, value: unknown) => {
  if (!trustedRanga(event)) return;
  if (value === null) {
    clearDownload();
    context = undefined;
    query = "";
    publish();
    return;
  }
  if (!validContext(value, projectKey(event.senderFrame!.url, localUrl)))
    return;
  if (context?.key !== value.key || !value.editable) clearDownload();
  if (!context || context.key !== value.key || context.query !== value.query)
    query = value.query;
  context = value;
  syncReferenceLayout();
  publish();
});
ipcMain.on("ranga:chatgpt", (event) => {
  if (trustedRanga(event)) focusChatGPT();
});
ipcMain.on("ranga:canvas", (event, key: unknown) => {
  if (
    trustedRanga(event) &&
    context &&
    context.key === key &&
    context.editable &&
    key === projectKey(event.senderFrame!.url, localUrl)
  )
    setMode("focus");
});
ipcMain.on("workspace:mode", (event, value: unknown) => {
  if (trusted(event) && isMode(value)) setMode(value);
});
ipcMain.on("workspace:search", (event, value: unknown) => {
  if (!trusted(event) || !value || typeof value !== "object") return;
  const data = value as { query?: unknown; projectKey?: unknown };
  if (Object.keys(data).length === 2) search(data.query, data.projectKey);
});
ipcMain.on("workspace:resize", (event, value: unknown) => {
  if (
    trusted(event) &&
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.35 &&
    value <= 0.65
  ) {
    ratio = value;
    layout();
  }
});

ipcMain.on("workspace:select", (event, site: unknown) => {
  if (trusted(event) && isSite(site)) select(site);
});
ipcMain.on("workspace:command", (event, command: unknown) => {
  if (trusted(event) && isCommand(command)) runCommand(command);
});
ipcMain.on("workspace:ready", (event) => {
  if (trusted(event)) publish();
});

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({
    width: Math.max(960, Math.min(1480, workArea.width)),
    height: Math.max(650, Math.min(1000, workArea.height)),
    minWidth: 960,
    minHeight: 650,
    title: "Ranga Workspace",
    backgroundColor: "#f3f0e8",
    show: process.env.RANGA_DESKTOP_TEST !== "1",
    autoHideMenuBar: true,
    webPreferences: {
      ...securePreferences,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("page-title-updated", (event) =>
    event.preventDefault(),
  );
  window.on("resize", layout);
  window.on("focus", () => {
    if (externalOpened) {
      externalOpened = false;
      message =
        "Back in Ranga. Paste permitted results when ready. Reload a pane if needed.";
      publish();
    }
  });
  window.on("closed", () => {
    for (const view of views.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    views.clear();
    popups.clear();
    context = undefined;
    query = "";
    clearDownload();
    window = undefined;
  });
  void window.loadFile(toolbarPath);
  layout();
}

void app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      {
        label: "Workspace",
        submenu: [
          {
            label: "Ranga",
            accelerator: "CmdOrCtrl+1",
            click: () => select("ranga"),
          },
          {
            label: "ChatGPT",
            accelerator: "CmdOrCtrl+2",
            click: () => select("chatgpt"),
          },
          {
            label: "Pinterest",
            accelerator: "CmdOrCtrl+3",
            click: () => select("pinterest"),
          },
          {
            label: "Split workspace",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => runCommand("split"),
          },
          {
            label: "Discover",
            accelerator: "CmdOrCtrl+Alt+D",
            click: () => setMode("discover"),
          },
          {
            label: "Focus Ranga",
            accelerator: "CmdOrCtrl+Alt+F",
            click: () => setMode("focus"),
          },
          {
            label: "Bring into Ranga",
            accelerator: "CmdOrCtrl+Alt+B",
            click: () => runCommand("bring"),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          {
            label: "Reload page",
            accelerator: "CmdOrCtrl+R",
            click: () => runCommand("reload"),
          },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (!window) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
