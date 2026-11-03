# Architecture decisions

## 001: Preserve the native editor

Accepted 2026-11-02. Keep the existing Next.js/React/Fabric implementation and original editorial design. The stable, renderer-independent scene model remains the source of truth. Keep schema version 1 because new brief, reference, and line-height fields are optional and existing backups remain valid. A future incompatible schema change requires a migration before validation.

## 002: Manual creative handoff

Accepted 2026-11-03 following the revised brief. No OpenAI, Pinterest, or Canva API is part of this MVP. External links open the user's own browser sessions. Ranga does not read cookies, control extensions, scrape reference pages, or download linked images. A deterministic prompt and strict, published recipe schema support manual exchange. Images remain raster layers.

## 003: Field-level Yjs documents

Accepted 2026-11-03. Each layer/reference has a Y.Map, layer text uses Y.Text, and stacking/reference order uses Y.Array. Local changes update only changed fields. A server validates a proposed Yjs update against the scene and project asset ownership before applying and persisting it. Updates are acknowledged only after persistence. Cursors remain transient. Per-client undo tracks local origins, preserves remote work, and keeps up to 100 undo entries.

## 004: Persistent local service before hosted infrastructure

Accepted 2026-11-03. Use a separate Node.js WebSocket/HTTP service and Better Auth. The existing environment had no configured PostgreSQL or object-storage service. Use SQLite WAL with tracked SQL migrations and separate binary asset/thumbnail tables for a working, zero-credential local collaboration profile. Do not embed binaries in CRDT updates. This is an explicit development tradeoff, not a claim that the PostgreSQL/object-storage production requirement has been met.

The next infrastructure milestone is PostgreSQL and private object storage, authenticated HTTPS/WSS routing, verified email delivery, quotas, monitored backups, and a migration rehearsal. Persistent WebSockets require a suitable host; a serverless frontend alone is insufficient.

## 005: Server-enforced roles and local email outbox

Accepted 2026-11-03. Authenticate every protected HTTP operation, WebSocket handshake, and document update. Recheck sessions periodically; revoke active member sockets immediately. Invitations use random 256-bit tokens stored as hashes, expire after seven days, and are single-user. Only owners manage access/delete/restore; editors change designs; commenters discuss; viewers read/export.

Password recovery writes to an ignored private development outbox. No email is sent. Email-restricted invitations match an account's email but do not prove mailbox ownership in this local profile. Verified email, public abuse controls, and production cookie/HTTPS review are launch requirements. The service rejects non-loopback origins to prevent accidental public exposure.

## 006: Preserve local work and portable exports

Accepted 2026-11-03. Browser projects remain separate and available without an account. Sharing creates an explicit server copy. Exported JSON/SVG resolve authorized shared assets into portable embedded data. Duplicating a shared project creates a separately owned copy with no inherited collaborators. Previous local work is never uploaded automatically.
