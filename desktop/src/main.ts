import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell,
  WebContentsView,
} from "electron";
import type { IpcMainEvent, WebContents, Session } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import {
  allowedNavigation,
  externalUrl,
  isCommand,
  isSite,
  originLabel,
  paneBounds,
  rangaUrl,
  type Command,
  type Site,
  type WorkspaceState,
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
};

let window: BrowserWindow | undefined;
const views = new Map<Site, WebContentsView>();
const popups = new Set<BrowserWindow>();
const configuredSessions = new Set<Session>();
const failures = new Map<Site, string>();
let selected: Site = "ranga";
let focused: Site = "ranga";
let split = false;
let message =
  "Copy prompts and import designs manually. Your browser projects stay in their original profile.";
let pendingLink: string | undefined;

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
  });
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
  contents.on("did-finish-load", () => {
    failures.delete(site);
    publish();
  });
  contents.on(
    "did-fail-load",
    (_event, code, _description, _url, isMainFrame) => {
      if (!isMainFrame || code === -3) return;
      const failure =
        site === "ranga"
          ? "Ranga is offline. Start the web app on port 3001, then press Reload. See Help for the commands."
          : `${names[site]} could not load. Try Reload or Open in browser; sign-in may require a regular browser.`;
      failures.set(site, failure);
      if (focused === site) message = failure;
      publish();
    },
  );
  contents.on("render-process-gone", () => {
    failures.set(
      site,
      `${names[site]} stopped responding. Press Reload to reopen it.`,
    );
    message = "";
    publish();
  });
}

function ensureView(site: Site) {
  let view = views.get(site);
  if (view) return view;
  const ses = session.fromPartition(`persist:ranga-workspace-${site}`);
  configureSession(ses, site);
  view = new WebContentsView({
    webPreferences: { ...securePreferences, session: ses },
  });
  views.set(site, view);
  view.setBackgroundColor("#faf8f2");
  protectContents(view.webContents, site);
  window!.contentView.addChildView(view);
  void view.webContents.loadURL(homeUrls[site]).catch(() => {
    /* did-fail-load reports it */
  });
  return view;
}

function layout() {
  if (!window || window.isDestroyed()) return;
  const visible: Site[] =
    split && selected !== "ranga" ? ["ranga", selected] : [selected];
  const [width, height] = window.getContentSize();
  const bounds = paneBounds(width, height, visible.length === 2);
  visible.forEach((site) => ensureView(site));
  for (const [site, view] of views) {
    const index = visible.indexOf(site);
    view.setVisible(index >= 0);
    if (index >= 0) view.setBounds(bounds[index]);
  }
  publish();
}

function select(site: Site) {
  selected = site;
  focused = site;
  if (site === "ranga") split = false;
  message = "";
  pendingLink = undefined;
  layout();
  views.get(site)?.webContents.focus();
}

async function openInBrowser(url: string | undefined) {
  if (!url) return;
  try {
    await shell.openExternal(url);
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
      split = !split;
      if (split && selected === "ranga") selected = "chatgpt";
      focused = selected;
      message = "";
      layout();
      views.get(selected)?.webContents.focus();
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
            "Start Ranga in two terminals from the repository folder:\n\nnpm run service\nnpm run dev -- --port 3001\n\nSelect ChatGPT or Pinterest, then Split workspace. Sign in yourself. Copy a prompt from Ranga and paste it into ChatGPT; paste the returned JSON recipe into Ranga. Download images you may use and upload them in the editor.\n\nDesktop sessions are separate from Chrome/Edge. To move a browser-only project, export its JSON backup and import it here. Shared projects are available after signing into Ranga.\n\nSome websites or login providers may reject embedded browsers. Open in browser uses your regular browser instead. No APIs, account automation, or automatic transfers are included.",
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
  window = new BrowserWindow({
    width: 1480,
    height: 1000,
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
  window.on("closed", () => {
    for (const view of views.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    views.clear();
    popups.clear();
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
