# Ranga Workspace desktop preview

An optional Electron desktop window for Ranga, ChatGPT, and Pinterest. Select a site or use **Split workspace** to keep Ranga on the left and a creative tool on the right. No third-party API keys are required. This is an experimental source-run desktop shell, not a packaged browser release.

## Start

Use Node.js 24. From the repository root, install the web app with `npm ci`, then run these in separate terminals:

```sh
npm run service
```

```sh
npm run dev -- --port 3001
```

In a third terminal:

```sh
npm ci --prefix desktop
npm start --prefix desktop
```

The first desktop launch downloads the pinned official Electron runtime if needed. Installing only the root package does not install Electron. The desktop connects to the local web app; it does not bundle or manage the web/service processes yet. Existing production servers on port 3001 also work. With the service offline, browser-only projects still work; shared projects require the service.

## Use your existing work

Desktop has its own browser profile. It cannot see local projects saved in Chrome, Edge, or the Codex browser. Export a **JSON backup** from your original Ranga editor, then import the backup in desktop. Sign into your Ranga account to access shared projects on the same local service. Desktop does not automatically copy or upload any project.

Sign into ChatGPT and Pinterest yourself in their panes. Sessions persist separately for each site. Existing Chrome/Edge sign-ins are not imported. Some sites and identity providers reject embedded browsers or require features this preview does not support. **Open in browser** opens the site's home page in your regular browser; it does not transfer the desktop session or its sign-in URL. Authenticated ChatGPT/Pinterest compatibility is not guaranteed or verified by the automated tests.

1. Add reference links, descriptions, or images you have permission to use in Ranga.
2. Copy the prompt from Ranga's creative handoff panel and paste it into ChatGPT.
3. Copy the resulting JSON recipe into Ranga's recipe importer for validation and editable layers.
4. Download any permitted image yourself, then upload it in Ranga. Use the reference board's paste area with Ctrl/Cmd+V for clipboard images. The separate **Paste image** button uses clipboard-read permission, which this preview denies.

There is no automatic account connection, scraping, prompt submission, image download, or transfer of website content. The sites' normal terms, subscriptions, usage limits, and sign-in requirements still apply. The Ranga project license does not license their brands or content.

## Controls

- **Ranga / ChatGPT / Pinterest**: select a pane. Ctrl/Cmd+1, 2, or 3 also work.
- **Split workspace**: Ranga on the left; the selected creative tool on the right. Ctrl/Cmd+Shift+S toggles it. Selecting Ranga returns to a single pane.
- **Back / Forward / Reload / Site home**: operate on the last focused visible pane. Click a pane to focus it. Ctrl/Cmd+R reloads it.
- **Open in browser**: open that site's home page externally. Other HTTPS destinations show an explicit **Open link** choice in the toolbar.
- **Help**: startup commands, project migration, and manual handoff instructions.

## Configuration and privacy

Optional environment variables:

| Variable                | Purpose                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RANGA_DESKTOP_URL`     | Local Ranga URL. Default `http://127.0.0.1:3001/projects`. Only loopback HTTP/HTTPS is accepted. Use the same origin as your collaboration service configuration. |
| `RANGA_DESKTOP_PROFILE` | Absolute path for a separate desktop profile. Default is Electron's application user-data directory. Use `desktop/.profiles/` for an ignored development profile. |
| `RANGA_DESKTOP_TEST=1`  | Hide the window for automated tests. Does not relax website security or navigation rules.                                                                         |

Browser storage, site cookies, and local Ranga projects persist in the desktop profile. Keep it private and export work before deleting it. This shell has no sync or telemetry service, but third-party sites still make their own network requests when you open them.

Website panes use separate persistent sessions and sandboxed `WebContentsView` instances. Node integration and privileged preloads are absent from every website pane. Only the local toolbar has a narrow IPC bridge, with sender/frame checks and fixed command names. Navigation is restricted to the selected site and explicitly listed sign-in hosts; system-browser handoff rejects executable/custom protocols. The toolbar shows the current origin without URL queries or fragments. Web security, certificate validation, and website headers remain enabled. Downloads prompt for a destination and are never auto-opened. Microphone, camera, location, devices, notifications, and programmatic clipboard reads are denied in this preview.

## Verify and contribute

```sh
npm test --prefix desktop
npm run test:smoke --prefix desktop
```

The smoke test requires the root dev dependencies (`npm ci`). It launches Electron in an isolated temporary profile, serves a synthetic local Ranga page, and uses clearly labeled third-party page fixtures. It checks actual pane switching/splitting, session isolation, renderer privileges, page history, external-link handling, resizing, and offline recovery. It does not sign into live services or touch the user's browser data. Linux requires a graphical session (for example, `xvfb-run -a npm run test:smoke --prefix desktop`). Windows sandboxed automation may need permission to launch Electron.

Windows is the initial verification target. Signed installers, application icons made in Ranga, auto-update delivery, portable server packaging, expanded platform testing, and a deeper desktop security review remain release work. Keep Electron updated before wider distribution.

Implementation follows Electron's [WebContentsView composition](https://www.electronjs.org/docs/latest/tutorial/web-embeds) and [security guidance](https://www.electronjs.org/docs/latest/tutorial/security). Ranga is independent of OpenAI and Pinterest.
