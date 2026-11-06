# Ranga Workspace desktop preview

An optional Electron desktop window for Ranga, ChatGPT, and Pinterest, with **Ranga Discover** search and a project reference tray. Search once to open Pinterest search and prepare a local ChatGPT prompt. No third-party API keys are required. This is an experimental source-run desktop shell, not a packaged browser release.

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

1. Open a Ranga project, then enter a design query in the desktop search bar. **Search** sends only the query to Pinterest and displays Pinterest beside ChatGPT. It does not send a ChatGPT message. Queries accept up to 500 characters, normalize whitespace, and reject hidden control characters.
2. Use **Prompt** to review the locally prepared instructions. An open project adds its brief, selected reference descriptions, requested changes, dimensions, available image IDs and existing recipe schema. Without a project, you get a general design-discussion prompt. Edit **Changes for ChatGPT** in References or Creative tools to specify what to keep or change.
3. Choose **Copy & ChatGPT**, then paste and submit yourself. **Copy instructions & open ChatGPT** in the editor's Creative tools panel also copies and focuses the desktop pane. Attach permitted images manually.
4. In Discover, choose **References** to open the active project's board below both website panes. The same editor becomes the tray; **Design** or **Focus** restores its canvas. The tray and Prompt drawer open one at a time. In Design/Focus, References opens the editor's normal board.
5. Choose **Bring into Ranga** in the toolbar to open the current project's return panel beside ChatGPT. Paste text, a link or a JSON recipe, or choose a JSON/PNG/JPEG/WebP file. Review the detected result before applying. Recipes show a rendered composition and use the existing editable layer importer after a saved checkpoint. Images require permission confirmation; choose Owned/Generated use and **Add image layer** for the canvas, or **Add reference** for the board. Use Ctrl/Cmd+V or Choose file when the explicit Read clipboard button is denied in desktop.
6. A completed supported download from ChatGPT or Pinterest offers **Import download** in the toolbar. Click it, then **Preview downloaded file** in Ranga. Review and confirm as above. Downloads still use the normal Save dialog. Nothing is read into Ranga until the import click, and nothing is applied until confirmation. The pending handoff is cleared when you change projects or dismiss it; the file stays on disk.

Editable projects save the latest discovery query through the normal document history, autosave and shared synchronization. **Creative tools → Discovery query** also lets you edit it on the web. Viewers/commenters can search but their new query stays only in the desktop session; they cannot change saved project metadata. Queries without an open project also stay in memory. Opening another project restores that project's query. Prompts are not stored separately, and Ranga does not capture ChatGPT conversations.

Pinterest's website search route was checked on 2026-11-04: the query appeared in its search field, followed by a login gate. It is not a guaranteed API. If direct navigation fails, Ranga attempts Pinterest home once; open **Prompt → Copy query** and paste into Pinterest's own search box. **Retry search** retries explicitly. A loaded page does not prove successful sign-in or relevant results. Known sign-in routes are labeled; login modals and browser-rejection messages remain the website's own UI. Use **Help** and **Open in browser** when needed. See Pinterest's [search guidance](https://help.pinterest.com/en-gb/article/search-for-ideas-on-pinterest).

There is no automatic account connection, scraping, prompt submission, image download, or transfer of website content. The sites' normal terms, subscriptions, usage limits, and sign-in requirements still apply. The Ranga project license does not license their brands or content.

## Controls

- **Ranga / ChatGPT / Pinterest**: select a pane. Ctrl/Cmd+1, 2, or 3 also work.
- **Discover**: Pinterest and ChatGPT together. Ctrl/Cmd+Alt+D opens it.
- **Design**: Ranga with ChatGPT. **Focus** expands Ranga and closes the prompt panel; Ctrl/Cmd+Alt+F also works.
- **Prompt**: review/copy the generated prompt or query, retry a search, adjust pane proportions between 35% and 65%, swap sides, or close the panel. It never overlays the native views. At compact window sizes, close the panel or use a single tool for more room.
- **Split workspace**: Ranga on the left; the selected creative tool on the right. Ctrl/Cmd+Shift+S toggles it. Selecting Ranga returns to a single pane.
- **Back / Forward / Reload / Site home**: operate on the last focused visible pane. Click a pane to focus it. Ctrl/Cmd+R reloads it.
- **Open in browser**: open that site's home page externally. Other HTTPS destinations show an explicit **Open link** choice in the toolbar.
- **Help**: startup commands, project migration, and manual handoff instructions.
- **Bring into Ranga**: open the current project's return panel in Design mode; Ctrl/Cmd+Alt+B also works. It does not read the clipboard. A project must be open, and only its owner/editor can import.
- **Import download**: offer the latest completed supported file for review in the project where its download began. A changed, missing or oversized file produces a Choose file fallback. The adjacent dismiss control clears the offer without deleting the file.

## Collect references

Choose the **Destination project** before preparing an import. The selector lists local projects in this desktop profile and shared projects available to your Ranga account. Current work must finish saving before a switch. Switching projects clears any unconfirmed preview; it does not move references between projects. Read-only projects cannot receive imports.

Drop browser-provided PNG/JPEG/WebP files, plain text or a source link into the focused area, paste with Ctrl/Cmd+V, choose **Image**, or enter a written reference. Every entry has a preview and **Add reference** confirmation. Image files additionally require permission confirmation. Choose Inspiration, Owned/licensed, or Generated, and add attribution and notes. Generated images remain raster images; adding to the reference board does not insert a canvas layer.

Image files keep the existing 5 MB, 24-megapixel and 10,000-pixel-side limits. MIME and file signatures must match. HTTP/HTTPS source links without credentials are saved as links, including links ending in image extensions. Ranga never downloads the linked image or parses dragged HTML. Up to 12 references use the existing selection, compare, collections, reordering, removal and creative-direction controls. The tray displays the real project save/sync state.

Cross-view drag data depends on Chromium and the source website. When no supported data arrives, use paste, a local file, or an attributed source URL. This does not guarantee arbitrary Pinterest image dragging. Programmatic clipboard reads remain denied in desktop; the Clipboard button explains the keyboard/file fallback. Temporary previews clear when leaving the board or changing between the tray and full editor.

## Prepare and return a concept

Selected reference names, use classifications and descriptions feed the prompt alongside saved keep/change/text/logo/color/layout/originality instructions. An image card with confirmed permission and Owned or Generated use can be downloaded for manual attachment in ChatGPT. Inspiration-only and source-only cards have no image download action. No external attachment or send is automated.

Recipe application requires the composition to match its rendered preview. Ranga checks again after saving the checkpoint, preserving newer metadata and refusing to overwrite intervening canvas edits or a changed destination/access role. Failed saves keep the preview available for retry. Owned/generated images with confirmed permission can be added to the canvas from the preview or an existing reference card. They are centered without replacing other layers, keep their attribution, and remain raster images. Undo and History provide recovery. Successful canvas imports focus Ranga; compact web layouts close the tool drawer so the result is visible.

First-party project prompts exceeding the 150 KB native message limit explicitly disable toolbar copying and direct you to Creative tools for the full prompt. An older prompt cannot remain available as if current. The new project-bound bring event only opens the return panel; it grants no clipboard or website access.

## Configuration and privacy

Optional environment variables:

| Variable                | Purpose                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RANGA_DESKTOP_URL`     | Local Ranga URL. Default `http://127.0.0.1:3001/projects`. Only loopback HTTP/HTTPS is accepted. Use the same origin as your collaboration service configuration.                                                                                               |
| `RANGA_DESKTOP_PROFILE` | Absolute path for a separate desktop profile. Source runs default to the ignored `desktop/.profiles/local/` directory, so reopening this checkout retains your desktop work and sign-ins. Packaged builds would use Electron's application user-data directory. |
| `RANGA_DESKTOP_TEST=1`  | Hide the window for automated tests. Does not relax website security or navigation rules.                                                                                                                                                                       |

Browser storage, site cookies, and local Ranga projects persist in the desktop profile. Keep it private and export work before deleting it. This shell has no sync or telemetry service, but third-party sites still make their own network requests when you open them.

Website panes use separate persistent sessions and sandboxed `WebContentsView` instances. Node integration is disabled everywhere. ChatGPT, Pinterest, and all popups have no preload. The local toolbar has a narrow IPC bridge for fixed commands, bounded search inputs and explicit clipboard writes. Only the configured first-party Ranga view receives a separate minimal bridge for project context, query/reference/return events, and fixed ChatGPT/canvas focus. Main validates sender, frame, origin, editor route, project key and payload bounds (including a 150 KB prompt limit). It cannot script external pages, read clipboard content, access cookies or open arbitrary files/URLs.

Navigation remains restricted to the selected site and explicitly listed sign-in hosts; system-browser handoff rejects executable/custom protocols. The toolbar shows the current origin without URL queries or fragments. Web security, certificate validation, and website headers remain enabled. Downloads prompt for a destination and are never auto-opened. A completed download records only one pending file in main-process memory. The explicit Import download command opens that recorded file, checks its identity/size/modification time, reads at most 5 MB for an image or 2 MB for JSON, and sends bounded bytes/name/type to the first-party project. File paths never cross IPC. There is no path-reading command or folder watcher. The existing image/recipe validators and permission confirmation still run before application.

Microphone, camera, location, devices, notifications, and programmatic clipboard reads remain denied. Dragging an unhandled file/link cannot navigate a pane. Other imports use ordinary first-party browser events and the existing project permissions; remote websites receive no additional privileges.

## Verify and contribute

```sh
npm test --prefix desktop
npm run test:smoke --prefix desktop
```

The three smoke tests require the root dev dependencies (`npm ci`). They launch Electron in isolated temporary profiles, serve synthetic first-party pages, and use clearly labeled third-party fixtures. They check search encoding, all workspace modes, prompt preparation, project switching, bounded/forged IPC, denied clipboard reads, explicit copying, layout/resize, sign-in-route labeling, failed-search fallback/retry, session isolation, navigation, offline recovery, completed-download confirmation, changed-file rejection and stale-project cleanup. Only test fixtures supply temporary download save paths to avoid OS dialogs. Clipboard writes and system-browser opens are stubbed so tests do not alter your OS clipboard or launch external browsers. Root browser tests separately exercise the real editor's query persistence, bridge event handling, shared permissions, image/recipe imports and exports. No automated test proves real-world third-party login compatibility.

For a separate browser test service while Ranga is open, set `RANGA_TEST_BASE_URL=http://127.0.0.1:3011` and `RANGA_TEST_SERVICE_PORT=3013` before `npm run test:e2e`. The test service uses `.ranga-test-data/browser-3013`. A custom production test build must use the matching `RANGA_BACKEND_URL` when building; the recorded Discover browser run uses the development server. Linux desktop tests require a graphical session (for example, `xvfb-run -a npm run test:smoke --prefix desktop`). Windows sandboxed automation may need permission to launch Electron.

Windows is the initial verification target. Signed installers, application icons made in Ranga, auto-update delivery, portable server packaging, expanded platform testing, and a deeper desktop security review remain release work. Keep Electron updated before wider distribution.

Implementation follows Electron's [WebContentsView composition](https://www.electronjs.org/docs/latest/tutorial/web-embeds) and [security guidance](https://www.electronjs.org/docs/latest/tutorial/security). Ranga is independent of OpenAI and Pinterest.
