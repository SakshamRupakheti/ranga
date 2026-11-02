# Ranga

A graphic design workspace built around editable compositions. The first milestone runs locally without API keys, accounts, or paid services. The product name is **Ranga**; its logo will be created using Ranga itself. The current header is plain typography, not a finished logo.

## Run locally

Use Node.js 24 LTS and npm. Dependencies are pinned in `package.json` and `package-lock.json`.

```sh
npm ci
npm run dev -- --port 3001
```

Open <http://127.0.0.1:3001>. Choose **Start designing** to edit the original Form & Field composition, or open the workspace for a blank canvas and other starting points.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --port 3001
```

`npm run test:e2e` runs real browser checks against a server on port 3001. Local tests use installed Google Chrome in an isolated temporary profile. CI installs Playwright Chromium, builds the application, and starts the production server automatically. No tests use the user's browser data.

The production build uses Next.js's supported Webpack mode. Turbopack development works locally, but its production CSS worker failed on the initial Windows host. This is documented in `docs/VERIFICATION.md`.

## What this milestone includes

- Original responsive introduction, project workspace, graphic editor, brand kit, and settings.
- Editable text, rectangles, ellipses, and raster images with stable layer IDs.
- Native drag, resize, rotate, and direct text editing; precise property fields, fonts, alignment, spacing, color, opacity, visibility, locks, and stacking order.
- Layer duplication/deletion, undo/redo, zoom, fit-to-view, and scrolling around a zoomed canvas.
- Local autosave, project rename/duplicate/delete, and up to 20 explicit version snapshots per project.
- PNG export at the document's pixel dimensions; SVG export with editable text/shapes and embedded raster images; schema-validated Ranga JSON backups and imports.
- Local reference uploads, selection, and creative-direction notes, stored independently from exported artwork.
- Reusable brand name, two colors, preferred typeface, and logo upload/application.
- Clearly disclosed local storage and unavailable integration states, with complete local workspace deletion.

Projects are genuinely empty on a fresh browser. The two included starting compositions are original editable templates, not fictitious customer projects.

## Storage and limits

Data stays in this browser profile's IndexedDB. There is **no account isolation, encryption layer, cloud sync, or server project database in this milestone**. Someone using the same browser profile can access the same projects. Clearing site data removes them. Export project backups regularly.

PNG/JPG/WebP uploads are limited to 5 MB, 24 megapixels, and 10,000 pixels per side. SVG upload is deliberately not supported. Canvas dimensions are 100–4096 pixels per side, with at most 200 layers and 12 references. Imports are limited to 30 MB and validated; external image URLs and SVG data payloads are rejected. Browser storage quotas still apply. Save failures are displayed, not reported as success.

A `.ranga.json` backup contains the current composition and reference images. Version snapshots and the separately stored brand kit are not included. SVG text depends on font availability in the destination tool. Imported and generated raster images remain single image layers; their contents are not independently editable.

## Project structure

```text
src/app/                 Next.js routes and design tokens
src/components/          Application shell, canvas adapter, editor, inspector
src/lib/document.ts      Versioned document schema, validated operations, history
src/lib/storage.ts       IndexedDB persistence boundary
src/lib/files.ts         Upload validation and downloads
tests/                   Model tests and browser workflow tests
docs/                    Architecture, design system, verification, launch checklist
.github/                 Quality checks and dependency monitoring configuration
```

The editor is dynamically loaded so the landing page does not load Fabric.js. React state owns the document; Fabric.js handles interaction and rendering. The canvas adapter translates native edits back into the structured model. Future AI commands will use schema-validated operations, never arbitrary generated JavaScript.

## Not connected yet

At the founder's request, API and service configuration is deferred. Authentication, managed PostgreSQL/object storage, AI, Pinterest, Canva, remote GitHub synchronization, and hosting are not represented as working features. Do not publish this development preview as a production service.

Persistent groups, masks, custom font uploads, a dedicated hand/pan tool, accessible canvas announcements, robust multi-tab conflict handling, and browser coverage beyond Chromium remain open. See [TASKS.md](TASKS.md).

## GitHub connection

Git is initialized locally. The available GitHub connector does not expose repository creation, and no GitHub CLI or authenticated write remote was available. No remote repository or deployment has been created.

When service setup is resumed, create an **empty private** GitHub repository named `ranga` under the desired owner. Authorize this environment to write to it, or provide the repository URL through the connected GitHub app. Then add that verified URL as `origin` and push `main`, `develop`, and the feature branch. No tokens belong in remote URLs or project files. CI and Dependabot configuration become active only after pushing to GitHub. Enable branch protection for `main` and require the `quality` job after its first successful remote run.

See [architecture and integration assessment](docs/ARCHITECTURE.md), [design system](docs/DESIGN_SYSTEM.md), [verification](docs/VERIFICATION.md), and [launch checklist](docs/LAUNCH_CHECKLIST.md).
