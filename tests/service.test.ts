import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdir, rm, readdir, readFile } from "node:fs/promises";
import * as Y from "yjs";
import WebSocket from "ws";
import sharp from "sharp";
import {
  createDocument,
  newLayer,
  type DesignDocument,
} from "../src/lib/document";
import { readShared, writeShared } from "../src/lib/shared-document";

const origin = "http://127.0.0.1:3001",
  base = "http://127.0.0.1:3004";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await delay(25);
  }
  assert.fail("Timed out waiting for collaboration state");
}

test(
  "authenticated multi-session service enforces roles and persists concurrent editing across reconnect and restart",
  { timeout: 60000 },
  async () => {
    const root = resolve(".ranga-test-data"),
      directory = join(root, crypto.randomUUID());
    await mkdir(directory, { recursive: true });
    let child: ChildProcess | undefined;
    const sockets: WebSocket[] = [];
    async function start() {
      child = spawn(
        process.execPath,
        ["--import", "tsx", "src/server/service.ts"],
        {
          windowsHide: true,
          env: {
            ...process.env,
            RANGA_SERVICE_PORT: "3004",
            RANGA_ORIGIN: origin,
            RANGA_DATA_DIR: directory,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      await new Promise<void>((ok, fail) => {
        const timeout = setTimeout(
          () => fail(new Error("Test service did not start")),
          15000,
        );
        child!.stdout!.on("data", (data: Buffer) => {
          if (data.toString().includes("service ready")) {
            clearTimeout(timeout);
            ok();
          }
        });
        child!.once("error", fail);
        child!.once("exit", (code) => {
          if (code) {
            clearTimeout(timeout);
            fail(new Error("Test service exited"));
          }
        });
      });
    }
    async function stop() {
      if (!child || child.exitCode !== null) return;
      const exited = new Promise<void>((r) => child!.once("exit", () => r()));
      child.kill();
      await exited;
    }
    async function request(
      cookie: string,
      path: string,
      method = "GET",
      data?: unknown,
      expected = 200,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      assert.equal(
        response.status,
        expected,
        `${method} ${path} returned ${response.status}`,
      );
      return response;
    }
    async function account(name: string) {
      const response = await request(
        "",
        "/api/auth/sign-up/email",
        "POST",
        {
          email: `${name}@ranga.test`,
          name,
          password: "Ranga-test-password-123",
        },
        200,
      );
      return {
        cookie: response.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; "),
        user: (await response.json()).user,
      };
    }
    async function connect(cookie: string, id: string) {
      const socket = new WebSocket(
        `ws://127.0.0.1:3004/collaboration?project=${id}`,
        { origin, headers: { Cookie: cookie } },
      );
      sockets.push(socket);
      const doc = new Y.Doc();
      let synced = false,
        acks = 0,
        closed = 0;
      socket.on("error", () => {});
      socket.on("close", (code) => {
        closed = code;
      });
      socket.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.type === "sync" || m.type === "update") {
          Y.applyUpdate(doc, Buffer.from(m.data, "base64"), "remote");
          if (m.type === "sync") synced = true;
        }
        if (m.type === "ack") acks++;
      });
      await until(() => synced);
      return {
        socket,
        doc,
        get acks() {
          return acks;
        },
        get closed() {
          return closed;
        },
        send(next: DesignDocument) {
          const before = readShared(doc),
            vector = Y.encodeStateVector(doc);
          writeShared(doc, next, before);
          socket.send(
            JSON.stringify({
              type: "update",
              data: Buffer.from(Y.encodeStateAsUpdate(doc, vector)).toString(
                "base64",
              ),
            }),
          );
        },
      };
    }
    try {
      await start();
      await request("", "/api/projects", "GET", undefined, 401);
      const owner = await account("owner"),
        editor = await account("editor"),
        commenter = await account("commenter");
      await delay(11000);
      const viewer = await account("viewer"),
        stranger = await account("stranger");
      const scene = createDocument("editorial");
      const { id } = await (
        await request(
          owner.cookie,
          "/api/projects",
          "POST",
          { document: scene },
          201,
        )
      ).json();
      const path = `/api/projects/${id}`;
      await request(stranger.cookie, path, "GET", undefined, 403);
      async function invite(to: typeof owner, role: string) {
        const { url } = await (
          await request(
            owner.cookie,
            path + "/invitations",
            "POST",
            { role, email: to.user.email },
            201,
          )
        ).json();
        const token = new URL(url).hash.slice(1);
        await request(
          stranger.cookie,
          "/api/invitations/accept",
          "POST",
          { token },
          403,
        );
        await request(to.cookie, "/api/invitations/accept", "POST", { token });
        return token;
      }
      const editorToken = await invite(editor, "editor");
      await invite(editor, "viewer");
      await request(editor.cookie, "/api/invitations/accept", "POST", {
        token: editorToken,
      });
      assert.equal(
        (await (await request(editor.cookie, path)).json()).role,
        "viewer",
      );
      await invite(editor, "editor");
      await invite(commenter, "commenter");
      await invite(viewer, "viewer");
      await request(
        editor.cookie,
        path + "/invitations",
        "POST",
        { role: "owner" },
        403,
      );
      await request(viewer.cookie, path, "DELETE", undefined, 403);
      const png = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#bd442d" },
      })
        .png()
        .toBuffer();
      const image = `data:image/png;base64,${png.toString("base64")}`;
      const { src } = await (
        await request(
          editor.cookie,
          path + "/assets",
          "POST",
          { src: image },
          201,
        )
      ).json();
      await request(stranger.cookie, src, "GET", undefined, 403);
      await request(viewer.cookie, src);
      await request(
        commenter.cookie,
        path + "/assets",
        "POST",
        { src: image },
        403,
      );
      const a = await connect(owner.cookie, id),
        b = await connect(editor.cookie, id);
      const one = readShared(a.doc),
        two = readShared(b.doc);
      one.layers[0].x = 310;
      two.layers[1].fill = "#112233";
      one.layers.push(newLayer("image", { src }));
      two.layers.push(newLayer("text", { text: "Concurrent creation" }));
      a.send(one);
      b.send(two);
      await until(
        () =>
          a.acks === 1 &&
          b.acks === 1 &&
          readShared(a.doc).layers.length === 12 &&
          readShared(b.doc).layers.length === 12,
      );
      assert.deepEqual(readShared(a.doc), readShared(b.doc));
      assert.equal(readShared(a.doc).layers[0].x, 310);
      assert.equal(readShared(a.doc).layers[1].fill, "#112233");
      const nextA = readShared(a.doc),
        nextB = readShared(b.doc),
        textBefore = nextA.layers[0].text!;
      nextA.layers[0].text = textBefore + " A";
      nextB.layers[0].text = "B " + textBefore;
      a.send(nextA);
      b.send(nextB);
      await until(
        () =>
          a.acks === 2 &&
          b.acks === 2 &&
          readShared(a.doc).layers[0].text === `B ${textBefore} A` &&
          readShared(b.doc).layers[0].text === `B ${textBefore} A`,
      );
      await request(
        commenter.cookie,
        path + "/comments",
        "POST",
        {
          body: "Review the headline",
          elementId: one.layers[0].id,
          anchor: { x: 50, y: 80 },
        },
        201,
      );
      const { comments } = await (
        await request(owner.cookie, path + "/comments")
      ).json();
      assert.equal(comments[0].anchor_x, 50);
      await request(
        editor.cookie,
        path + "/comments",
        "POST",
        { body: "Updated", parentId: comments[0].id },
        201,
      );
      await request(
        viewer.cookie,
        path + "/comments",
        "POST",
        { body: "Forbidden" },
        403,
      );
      await request(
        commenter.cookie,
        path + `/comments/${comments[0].id}`,
        "PATCH",
        { resolved: true },
      );
      await request(owner.cookie, path + "/versions", "POST", {}, 201);
      const { versions } = await (
        await request(owner.cookie, path + "/versions")
      ).json();
      await request(
        editor.cookie,
        path + `/versions/${versions[0].id}/restore`,
        "POST",
        {},
        403,
      );
      const changed = readShared(a.doc);
      changed.title = "Changed title";
      a.send(changed);
      await until(() => a.acks === 3);
      await request(
        owner.cookie,
        path + `/versions/${versions[0].id}/restore`,
        "POST",
        {},
      );
      await until(
        () =>
          readShared(a.doc).title === scene.title &&
          readShared(b.doc).title === scene.title,
      );
      const v = await connect(viewer.cookie, id);
      const invalid = readShared(v.doc);
      invalid.title = "Forbidden mutation";
      v.send(invalid);
      await until(() => v.closed === 1008);
      assert.equal(
        (await (await request(owner.cookie, path)).json()).document.title,
        scene.title,
      );
      await request(
        owner.cookie,
        path + `/members/${editor.user.id}`,
        "DELETE",
      );
      await until(() => b.closed === 1008);
      await request(editor.cookie, path, "GET", undefined, 403);
      await request(
        editor.cookie,
        "/api/invitations/accept",
        "POST",
        { token: editorToken },
        400,
      );
      // Offline local edits merge with persisted server state on a new connection.
      a.socket.close();
      await until(() => a.closed !== 0);
      const offline = readShared(a.doc);
      offline.layers[0].x = 777;
      writeShared(a.doc, offline, readShared(a.doc));
      const reconnect = await connect(owner.cookie, id);
      reconnect.socket.send(
        JSON.stringify({
          type: "update",
          data: Buffer.from(
            Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(reconnect.doc)),
          ).toString("base64"),
        }),
      );
      await until(() => reconnect.acks === 1);
      for (const socket of sockets) socket.terminate();
      await stop();
      await start();
      const recovered = await (await request(owner.cookie, path)).json();
      assert.equal(recovered.document.layers[0].x, 777);
      assert.equal(recovered.document.layers.length, 12);
      assert.equal(
        (await (await request(commenter.cookie, path + "/comments")).json())
          .comments.length,
        2,
      );
      await request(viewer.cookie, src);
      await request(owner.cookie, path, "PATCH", { title: "Renamed safely" });
      await request(viewer.cookie, path, "PATCH", { title: "Forbidden" }, 403);
      const revision = (await (await request(owner.cookie, path)).json())
        .document.updatedAt;
      await request(owner.cookie, path + "/thumbnail", "PUT", {
        src: image,
        revision,
      });
      await request(viewer.cookie, path + "/thumbnail");
      await request(
        stranger.cookie,
        path + "/thumbnail",
        "GET",
        undefined,
        403,
      );
      // Recovery sends no external email, and using a reset invalidates existing sessions.
      await request(
        stranger.cookie,
        "/api/auth/request-password-reset",
        "POST",
        { email: stranger.user.email, redirectTo: "/recover" },
      );
      const files = await readdir(join(directory, "outbox"));
      const mail = JSON.parse(
        await readFile(join(directory, "outbox", files[0]), "utf8"),
      );
      const token = new URL(mail.url).pathname.split("/").pop();
      await request("", "/api/auth/reset-password", "POST", {
        token,
        newPassword: "New-ranga-test-password-123",
      });
      await request(stranger.cookie, "/api/projects", "GET", undefined, 401);
      await request(
        "",
        "/api/auth/reset-password",
        "POST",
        { token, newPassword: "New-ranga-test-password-123" },
        400,
      );
      await request(owner.cookie, "/api/auth/delete-user", "POST", {
        password: "Ranga-test-password-123",
      });
      await request(viewer.cookie, path, "GET", undefined, 404);
    } finally {
      for (const socket of sockets) socket.terminate();
      await stop();
      const target = resolve(directory);
      if (target.startsWith(root + "\\") || target.startsWith(root + "/"))
        await rm(target, { recursive: true, force: true });
    }
  },
);
