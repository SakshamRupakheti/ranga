import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import * as Y from "yjs";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "./auth";
import { db, origin } from "./store";
import {
  documentSchema,
  embeddedImageSchema,
  type DesignDocument,
} from "../lib/document";
import {
  createShared,
  readShared,
  writeShared,
  canEdit,
  type ProjectRole,
  type Presence,
} from "../lib/shared-document";
import { getMigrations } from "better-auth/db/migration";

type User = { id: string; name: string; email: string };
type Project = {
  id: string;
  owner_id: string;
  title: string;
  state: Buffer;
  created_at: string;
  updated_at: string;
};
type Peer = {
  socket: WebSocket;
  user: User;
  role: ProjectRole;
  presence: Presence;
  headers: IncomingMessage["headers"];
  count: number;
  since: number;
  alive: boolean;
};
type Room = { doc: Y.Doc; peers: Set<Peer>; lastActivity: number };
const rooms = new Map<string, Room>();
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const now = () => new Date().toISOString();
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024)
      throw new HttpError(413, "Request exceeds 32 MB.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
function project(id: string) {
  const p = db.prepare("SELECT * FROM ranga_project WHERE id=?").get(id) as
    Project | undefined;
  if (!p) throw new HttpError(404, "Project not found.");
  return p;
}
function role(id: string, userId: string): ProjectRole {
  const p = project(id);
  if (p.owner_id === userId) return "owner";
  const member = db
    .prepare("SELECT role FROM ranga_member WHERE project_id=? AND user_id=?")
    .get(id, userId) as { role: ProjectRole } | undefined;
  if (!member)
    throw new HttpError(403, "You do not have access to this project.");
  return member.role;
}
function requireEdit(id: string, userId: string) {
  const r = role(id, userId);
  if (!canEdit(r))
    throw new HttpError(403, "Your role cannot edit this project.");
  return r;
}
function requireOwner(id: string, userId: string) {
  if (role(id, userId) !== "owner")
    throw new HttpError(403, "Only the owner can manage access.");
}
function room(id: string): Room {
  let r = rooms.get(id);
  if (!r) {
    const p = project(id),
      doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(p.state));
    r = { doc, peers: new Set(), lastActivity: 0 };
    rooms.set(id, r);
  }
  return r;
}
function send(peer: Peer, message: unknown) {
  if (peer.socket.readyState === WebSocket.OPEN)
    peer.socket.send(JSON.stringify(message));
}
function broadcast(r: Room, message: unknown, except?: Peer) {
  for (const peer of r.peers) if (peer !== except) send(peer, message);
}
function presence(r: Room) {
  broadcast(r, {
    type: "presence",
    people: [...r.peers].map((p) => p.presence),
  });
}
function activity(id: string, user: User, action: string) {
  db.prepare("INSERT INTO ranga_activity VALUES (?,?,?,?,?)").run(
    randomUUID(),
    id,
    user.name,
    action,
    now(),
  );
  db.prepare(
    "DELETE FROM ranga_activity WHERE project_id=? AND id NOT IN (SELECT id FROM ranga_activity WHERE project_id=? ORDER BY created_at DESC LIMIT 300)",
  ).run(id, id);
  const r = rooms.get(id);
  if (r) broadcast(r, { type: "event", event: "activity" });
}
function validateAssets(id: string, scene: DesignDocument) {
  for (const src of [
    ...scene.layers.map((l) => l.src),
    ...scene.references.map((r) => r.src),
  ].filter((s): s is string => !!s)) {
    if (!src.startsWith("/api/assets/"))
      throw new HttpError(
        400,
        "Shared documents must reference uploaded assets.",
      );
    if (
      !db
        .prepare("SELECT id FROM ranga_asset WHERE id=? AND project_id=?")
        .get(src.split("/").pop(), id)
    )
      throw new HttpError(403, "An image does not belong to this project.");
  }
}
async function asset(id: string, src: string) {
  embeddedImageSchema.parse(src);
  const comma = src.indexOf(",");
  const data = Buffer.from(src.slice(comma + 1), "base64");
  if (data.length > 5 * 1024 * 1024)
    throw new HttpError(413, "Images must be smaller than 5 MB.");
  const metadata = await sharp(data, {
    limitInputPixels: 24_000_000,
  }).metadata();
  if (
    !["png", "jpeg", "webp"].includes(metadata.format ?? "") ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 10000 ||
    metadata.height > 10000
  )
    throw new HttpError(400, "Unsupported image.");
  const aid = randomUUID();
  const mime = `image/${metadata.format}`;
  db.prepare("INSERT INTO ranga_asset VALUES (?,?,?,?,?)").run(
    aid,
    id,
    mime,
    data,
    now(),
  );
  return `/api/assets/${aid}`;
}
async function materialize(id: string, scene: DesignDocument) {
  const next = structuredClone(scene);
  const cache = new Map<string, string>();
  for (const element of [...next.layers, ...next.references])
    if (element.src?.startsWith("data:")) {
      let value = cache.get(element.src);
      if (!value) {
        value = await asset(id, element.src);
        cache.set(element.src, value);
      }
      element.src = value;
    }
  validateAssets(id, next);
  return next;
}
async function user(req: IncomingMessage) {
  const s = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!s) throw new HttpError(401, "Sign in to Ranga to continue.");
  return s.user;
}
function persist(id: string, r: Room) {
  const scene = readShared(r.doc);
  validateAssets(id, scene);
  const state = Buffer.from(Y.encodeStateAsUpdate(r.doc));
  if (state.length > 8 * 1024 * 1024)
    throw new HttpError(413, "Shared document exceeds 8 MB.");
  db.prepare(
    "UPDATE ranga_project SET title=?,state=?,updated_at=? WHERE id=?",
  ).run(scene.title, state, now(), id);
}
const authHandler = toNodeHandler(auth);
const limits = new Map<string, { count: number; expires: number }>();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", origin),
      path = url.pathname,
      method = req.method ?? "GET";
    if (path === "/api/health") {
      json(res, 200, {
        ok: true,
        mode: "local",
        websocketPort: Number(process.env.RANGA_SERVICE_PORT ?? 3003),
      });
      return;
    }
    if (!["GET", "HEAD"].includes(method) && req.headers.origin !== origin)
      throw new HttpError(403, "Origin rejected.");
    if (path.startsWith("/api/auth/")) {
      // This loopback-only service never trusts a caller-supplied IP header.
      req.headers["x-ranga-client-ip"] = req.socket.remoteAddress;
      await authHandler(req, res);
      return;
    }
    const u = await user(req);
    const key = u.id;
    const bucket = limits.get(key) ?? { count: 0, expires: Date.now() + 60000 };
    if (bucket.expires < Date.now()) {
      bucket.count = 0;
      bucket.expires = Date.now() + 60000;
    }
    bucket.count++;
    limits.set(key, bucket);
    if (bucket.count > 600)
      throw new HttpError(429, "Too many requests. Please wait.");
    if (path === "/api/projects" && method === "GET") {
      const rows = db
        .prepare(
          "SELECT DISTINCT p.id,p.title,p.owner_id,p.created_at,p.updated_at,m.role,EXISTS(SELECT 1 FROM ranga_thumbnail t WHERE t.project_id=p.id) AS has_thumbnail,(SELECT COUNT(*)+1 FROM ranga_member c WHERE c.project_id=p.id) AS collaborators FROM ranga_project p LEFT JOIN ranga_member m ON m.project_id=p.id AND m.user_id=? WHERE p.owner_id=? OR m.user_id=? ORDER BY p.updated_at DESC",
        )
        .all(u.id, u.id, u.id);
      json(res, 200, {
        projects: rows.map((raw) => {
          const p = raw as Project & { role: ProjectRole };
          return { ...p, role: p.owner_id === u.id ? "owner" : p.role };
        }),
      });
      return;
    }
    if (path === "/api/projects" && method === "POST") {
      const input = documentSchema.parse((await body(req)).document);
      const id = randomUUID();
      const initial = {
        ...input,
        id,
        createdAt: now(),
        updatedAt: now(),
        layers: [],
        references: [],
      };
      db.prepare("INSERT INTO ranga_project VALUES (?,?,?,?,?,?)").run(
        id,
        u.id,
        input.title,
        Buffer.from(Y.encodeStateAsUpdate(createShared(initial))),
        now(),
        now(),
      );
      try {
        const scene = await materialize(id, {
          ...input,
          id,
          createdAt: initial.createdAt,
          updatedAt: initial.updatedAt,
        });
        const doc = createShared(scene);
        db.prepare("UPDATE ranga_project SET state=? WHERE id=?").run(
          Buffer.from(Y.encodeStateAsUpdate(doc)),
          id,
        );
        doc.destroy();
        activity(id, u, "Created project");
        json(res, 201, { id });
      } catch (error) {
        db.prepare("DELETE FROM ranga_project WHERE id=?").run(id);
        throw error;
      }
      return;
    }
    const assetMatch = path.match(/^\/api\/assets\/([a-f0-9-]{36})$/);
    if (assetMatch && method === "GET") {
      const a = db
        .prepare("SELECT * FROM ranga_asset WHERE id=?")
        .get(assetMatch[1]) as
        { project_id: string; mime: string; data: Buffer } | undefined;
      if (!a) throw new HttpError(404, "Image not found.");
      role(a.project_id, u.id);
      res.writeHead(200, {
        "Content-Type": a.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(a.data);
      return;
    }
    if (path === "/api/invitations/accept" && method === "POST") {
      const token = z
        .string()
        .min(20)
        .max(100)
        .parse((await body(req)).token);
      const hash = createHash("sha256").update(token).digest("hex");
      const invitation = db
        .prepare("SELECT * FROM ranga_invite WHERE token_hash=?")
        .get(hash) as
        | {
            id: string;
            project_id: string;
            role: ProjectRole;
            email: string | null;
            expires_at: number;
            used_by: string | null;
            revoked: number;
          }
        | undefined;
      if (
        !invitation ||
        invitation.revoked ||
        invitation.expires_at < Date.now() ||
        (invitation.used_by && invitation.used_by !== u.id)
      )
        throw new HttpError(
          400,
          "This invitation is expired, revoked, or already used.",
        );
      if (invitation.email && invitation.email !== u.email.toLowerCase())
        throw new HttpError(
          403,
          "Sign in with the email this invitation was created for.",
        );
      if (invitation.used_by === u.id) {
        // Retrying an accepted link must never restore an older, higher role.
        role(invitation.project_id, u.id);
        json(res, 200, { id: invitation.project_id });
        return;
      }
      if (project(invitation.project_id).owner_id !== u.id)
        db.transaction(() => {
          db.prepare(
            "INSERT INTO ranga_member VALUES (?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role",
          ).run(invitation.project_id, u.id, invitation.role);
          db.prepare("UPDATE ranga_invite SET used_by=? WHERE id=?").run(
            u.id,
            invitation.id,
          );
        })();
      const existingRoom = rooms.get(invitation.project_id);
      if (existingRoom)
        for (const peer of existingRoom.peers)
          if (peer.user.id === u.id)
            peer.socket.close(1008, "Project role changed");
      activity(invitation.project_id, u, "Joined project");
      json(res, 200, { id: invitation.project_id });
      return;
    }
    const match = path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(.*))?$/);
    if (!match) throw new HttpError(404, "Not found.");
    const id = match[1],
      action = match[2] ?? "",
      access = role(id, u.id);
    if (!action && method === "GET") {
      json(res, 200, {
        document: readShared(room(id).doc),
        role: access,
        user: u,
      });
      return;
    }
    if (!action && method === "DELETE") {
      requireOwner(id, u.id);
      const r = rooms.get(id);
      if (r) {
        for (const p of r.peers) p.socket.close(1008, "Project deleted");
        r.doc.destroy();
        rooms.delete(id);
      }
      db.prepare("DELETE FROM ranga_project WHERE id=?").run(id);
      json(res, 200, { ok: true });
      return;
    }
    if (!action && method === "PATCH") {
      requireEdit(id, u.id);
      const title = z
        .string()
        .trim()
        .min(1)
        .max(120)
        .parse((await body(req)).title);
      const r = room(id),
        before = readShared(r.doc),
        vector = Y.encodeStateVector(r.doc);
      writeShared(
        r.doc,
        { ...before, title, updatedAt: now() },
        before,
        "rename",
      );
      persist(id, r);
      broadcast(r, {
        type: "update",
        data: Buffer.from(Y.encodeStateAsUpdate(r.doc, vector)).toString(
          "base64",
        ),
      });
      activity(id, u, "Renamed project");
      json(res, 200, { ok: true });
      return;
    }
    if (action === "thumbnail" && method === "GET") {
      const thumbnail = db
        .prepare("SELECT data FROM ranga_thumbnail WHERE project_id=?")
        .get(id) as { data: Buffer } | undefined;
      if (!thumbnail) throw new HttpError(404, "Preview is not available yet.");
      res.writeHead(200, {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(thumbnail.data);
      return;
    }
    if (action === "thumbnail" && method === "PUT") {
      requireEdit(id, u.id);
      const data = z
        .object({ src: embeddedImageSchema, revision: z.string().datetime() })
        .parse(await body(req));
      if (data.revision !== readShared(room(id).doc).updatedAt)
        throw new HttpError(409, "Preview revision is outdated.");
      const bytes = Buffer.from(data.src.split(",")[1], "base64");
      if (bytes.length > 2_000_000)
        throw new HttpError(413, "Preview is too large.");
      const preview = await sharp(bytes, { limitInputPixels: 4_000_000 })
        .resize({
          width: 400,
          height: 400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 75 })
        .toBuffer();
      if (data.revision !== readShared(room(id).doc).updatedAt)
        throw new HttpError(409, "Preview revision is outdated.");
      db.prepare(
        "INSERT INTO ranga_thumbnail VALUES (?,?,?) ON CONFLICT(project_id) DO UPDATE SET data=excluded.data,revision=excluded.revision",
      ).run(id, preview, data.revision);
      json(res, 200, { ok: true });
      return;
    }
    if (action === "assets" && method === "POST") {
      requireEdit(id, u.id);
      const src = await asset(id, z.string().parse((await body(req)).src));
      json(res, 201, { src });
      return;
    }
    if (action === "members" && method === "GET") {
      json(res, 200, {
        members: [
          {
            id: project(id).owner_id,
            name:
              (
                db
                  .prepare("SELECT name FROM user WHERE id=?")
                  .get(project(id).owner_id) as { name: string }
              )?.name ?? "Owner",
            role: "owner",
          },
          ...db
            .prepare(
              "SELECT m.user_id AS id,u.name,m.role FROM ranga_member m JOIN user u ON u.id=m.user_id WHERE m.project_id=?",
            )
            .all(id),
        ],
        invites:
          access === "owner"
            ? db
                .prepare(
                  "SELECT id,role,email,expires_at,used_by,revoked FROM ranga_invite WHERE project_id=? ORDER BY expires_at DESC",
                )
                .all(id)
            : [],
      });
      return;
    }
    if (action === "invitations" && method === "POST") {
      requireOwner(id, u.id);
      const data = z
        .object({
          role: z.enum(["editor", "commenter", "viewer"]),
          email: z.union([z.string().email(), z.literal("")]).optional(),
        })
        .parse(await body(req));
      const token = randomBytes(32).toString("base64url");
      db.prepare(
        "INSERT INTO ranga_invite (id,project_id,token_hash,role,email,expires_at) VALUES (?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        id,
        createHash("sha256").update(token).digest("hex"),
        data.role,
        data.email?.toLowerCase() || null,
        Date.now() + 7 * 86400000,
      );
      activity(id, u, `Created ${data.role} invitation`);
      json(res, 201, { url: `${origin}/invite#${token}`, expiresInDays: 7 });
      return;
    }
    if (action.startsWith("invitations/") && method === "DELETE") {
      requireOwner(id, u.id);
      db.prepare(
        "UPDATE ranga_invite SET revoked=1 WHERE id=? AND project_id=?",
      ).run(action.split("/")[1], id);
      activity(id, u, "Revoked invitation");
      json(res, 200, { ok: true });
      return;
    }
    if (action.startsWith("members/") && method === "DELETE") {
      requireOwner(id, u.id);
      const target = action.split("/")[1];
      db.transaction(() => {
        db.prepare(
          "DELETE FROM ranga_member WHERE project_id=? AND user_id=?",
        ).run(id, target);
        db.prepare(
          "UPDATE ranga_invite SET revoked=1 WHERE project_id=? AND used_by=?",
        ).run(id, target);
      })();
      const r = rooms.get(id);
      if (r)
        for (const p of r.peers)
          if (p.user.id === target) p.socket.close(1008, "Access revoked");
      activity(id, u, "Revoked collaborator access");
      json(res, 200, { ok: true });
      return;
    }
    if (action === "comments" && method === "GET") {
      json(res, 200, {
        comments: db
          .prepare(
            "SELECT * FROM ranga_comment WHERE project_id=? ORDER BY created_at",
          )
          .all(id),
      });
      return;
    }
    if (action === "comments" && method === "POST") {
      if (access === "viewer")
        throw new HttpError(403, "Viewers cannot comment.");
      const data = z
        .object({
          body: z.string().trim().min(1).max(3000),
          parentId: z.string().uuid().nullable().optional(),
          elementId: z.string().max(100).nullable().optional(),
          anchor: z
            .object({
              x: z.number().finite().min(0).max(4096),
              y: z.number().finite().min(0).max(4096),
            })
            .optional(),
        })
        .parse(await body(req));
      if (
        data.parentId &&
        !db
          .prepare(
            "SELECT id FROM ranga_comment WHERE id=? AND project_id=? AND parent_id IS NULL",
          )
          .get(data.parentId, id)
      )
        throw new HttpError(400, "Thread not found.");
      if (
        data.elementId &&
        !readShared(room(id).doc).layers.some((l) => l.id === data.elementId)
      )
        throw new HttpError(400, "Layer no longer exists.");
      db.prepare(
        "INSERT INTO ranga_comment VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        id,
        u.id,
        u.name,
        data.parentId ?? null,
        data.elementId ?? null,
        data.body,
        0,
        now(),
        data.anchor?.x ?? null,
        data.anchor?.y ?? null,
      );
      activity(id, u, "Added a comment");
      broadcast(room(id), { type: "event", event: "comments" });
      json(res, 201, { ok: true });
      return;
    }
    if (action.startsWith("comments/") && method === "PATCH") {
      if (access === "viewer")
        throw new HttpError(403, "Viewers cannot resolve comments.");
      const resolved = z.boolean().parse((await body(req)).resolved);
      db.prepare(
        "UPDATE ranga_comment SET resolved=? WHERE id=? AND project_id=? AND parent_id IS NULL",
      ).run(resolved ? 1 : 0, action.split("/")[1], id);
      activity(id, u, resolved ? "Resolved a comment" : "Reopened a comment");
      broadcast(room(id), { type: "event", event: "comments" });
      json(res, 200, { ok: true });
      return;
    }
    if (action === "activity" && method === "GET") {
      json(res, 200, {
        activity: db
          .prepare(
            "SELECT * FROM ranga_activity WHERE project_id=? ORDER BY created_at DESC LIMIT 60",
          )
          .all(id),
      });
      return;
    }
    if (action === "versions" && method === "GET") {
      json(res, 200, {
        versions: db
          .prepare(
            "SELECT id,author_name,created_at FROM ranga_version WHERE project_id=? ORDER BY created_at DESC",
          )
          .all(id),
      });
      return;
    }
    if (action === "versions" && method === "POST") {
      requireEdit(id, u.id);
      db.prepare("INSERT INTO ranga_version VALUES (?,?,?,?,?)").run(
        randomUUID(),
        id,
        u.name,
        JSON.stringify(readShared(room(id).doc)),
        now(),
      );
      db.prepare(
        "DELETE FROM ranga_version WHERE project_id=? AND id NOT IN (SELECT id FROM ranga_version WHERE project_id=? ORDER BY created_at DESC LIMIT 20)",
      ).run(id, id);
      activity(id, u, "Saved a version");
      broadcast(room(id), { type: "event", event: "versions" });
      json(res, 201, { ok: true });
      return;
    }
    if (action.match(/^versions\/[a-f0-9-]+\/restore$/) && method === "POST") {
      requireOwner(id, u.id);
      const v = db
        .prepare(
          "SELECT document FROM ranga_version WHERE id=? AND project_id=?",
        )
        .get(action.split("/")[1], id) as { document: string } | undefined;
      if (!v) throw new HttpError(404, "Version not found.");
      const r = room(id),
        before = Y.encodeStateVector(r.doc);
      writeShared(
        r.doc,
        documentSchema.parse(JSON.parse(v.document)),
        readShared(r.doc),
        "restore",
      );
      persist(id, r);
      broadcast(r, {
        type: "update",
        data: Buffer.from(Y.encodeStateAsUpdate(r.doc, before)).toString(
          "base64",
        ),
      });
      activity(id, u, "Restored a version");
      json(res, 200, { ok: true });
      return;
    }
    throw new HttpError(404, "Not found.");
  } catch (error) {
    json(
      res,
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500,
      {
        error:
          error instanceof HttpError
            ? error.message
            : error instanceof z.ZodError
              ? "The supplied data is invalid or unsupported."
              : "The local service could not complete this request.",
      },
    );
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
server.on("upgrade", async (req, socket, head) => {
  try {
    if (req.headers.origin !== origin) throw new Error();
    const url = new URL(req.url ?? "/", origin);
    if (url.pathname !== "/collaboration") throw new Error();
    const id = z.string().uuid().parse(url.searchParams.get("project"));
    const u = await user(req),
      access = role(id, u.id);
    wss.handleUpgrade(req, socket, head, (ws) => {
      const r = room(id),
        peer: Peer = {
          socket: ws,
          user: u,
          role: access,
          headers: req.headers,
          presence: {
            connectionId: randomUUID(),
            userId: u.id,
            name: u.name,
            role: access,
            selected: null,
          },
          count: 0,
          since: Date.now(),
          alive: true,
        };
      r.peers.add(peer);
      ws.on("pong", () => {
        peer.alive = true;
      });
      send(peer, {
        type: "sync",
        data: Buffer.from(Y.encodeStateAsUpdate(r.doc)).toString("base64"),
        vector: Buffer.from(Y.encodeStateVector(r.doc)).toString("base64"),
        role: access,
        userId: u.id,
      });
      presence(r);
      let chain = Promise.resolve();
      ws.on("message", (raw) => {
        chain = chain
          .then(async () => {
            if (ws.readyState !== WebSocket.OPEN) return;
            try {
              if (Date.now() - peer.since > 60000) {
                peer.since = Date.now();
                peer.count = 0;
              }
              if (++peer.count > 1800) throw new Error("Rate limit");
              const session = await auth.api.getSession({
                headers: fromNodeHeaders(peer.headers),
              });
              if (!session) throw new Error("Session expired");
              peer.role = role(id, u.id);
              const message = JSON.parse(raw.toString());
              if (message.type === "presence") {
                const data = z
                  .object({
                    selected: z.string().max(100).nullable(),
                    cursor: z
                      .object({
                        x: z.number().finite().min(-20000).max(20000),
                        y: z.number().finite().min(-20000).max(20000),
                      })
                      .nullable()
                      .optional(),
                  })
                  .parse(message);
                peer.presence = {
                  ...peer.presence,
                  selected: data.selected,
                  cursor: data.cursor,
                  role: peer.role,
                };
                presence(r);
                return;
              }
              if (message.type !== "update" || !canEdit(peer.role))
                throw new Error("Editing not permitted");
              const data = z.string().max(1_400_000).parse(message.data);
              const update = new Uint8Array(Buffer.from(data, "base64"));
              const probe = new Y.Doc();
              try {
                Y.applyUpdate(probe, Y.encodeStateAsUpdate(r.doc));
                Y.applyUpdate(probe, update);
                const scene = readShared(probe);
                if (scene.id !== id)
                  throw new Error("Project identity is immutable");
                validateAssets(id, scene);
                if (Y.encodeStateAsUpdate(probe).length > 8 * 1024 * 1024)
                  throw new Error("Document too large");
              } finally {
                probe.destroy();
              }
              Y.applyUpdate(r.doc, update);
              persist(id, r);
              broadcast(r, { type: "update", data }, peer);
              send(peer, { type: "ack" });
              if (Date.now() - r.lastActivity > 15000) {
                activity(id, u, "Edited the design");
                r.lastActivity = Date.now();
              }
            } catch {
              send(peer, {
                type: "error",
                message:
                  "Update rejected. Access may have changed or the document is invalid.",
              });
              ws.close(1008, "Update rejected");
            }
          })
          .catch(() => ws.close(1011, "Connection error"));
      });
      ws.on("close", () => {
        r.peers.delete(peer);
        presence(r);
        if (!r.peers.size) {
          r.doc.destroy();
          rooms.delete(id);
        }
      });
      ws.on("error", () => ws.close());
    });
  } catch {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
  }
});
const timer = setInterval(async () => {
  for (const [id, r] of rooms)
    for (const peer of r.peers) {
      try {
        if (!peer.alive) {
          peer.socket.terminate();
          continue;
        }
        peer.alive = false;
        peer.socket.ping();
        const s = await auth.api.getSession({
          headers: fromNodeHeaders(peer.headers),
        });
        if (!s) throw new Error();
        role(id, peer.user.id);
      } catch {
        peer.socket.close(1008, "Session or access expired");
      }
    }
  for (const [key, v] of limits) if (v.expires < Date.now()) limits.delete(key);
}, 15000);
timer.unref();
async function main() {
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  server.listen(
    Number(process.env.RANGA_SERVICE_PORT ?? 3003),
    "127.0.0.1",
    () => console.log("Ranga local account and collaboration service ready."),
  );
}
void main().catch(() => {
  console.error(
    "Ranga service startup failed. Check local database access and migration compatibility.",
  );
  process.exitCode = 1;
});
function stop() {
  clearInterval(timer);
  for (const r of rooms.values())
    for (const p of r.peers) p.socket.close(1012, "Service restarting");
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
