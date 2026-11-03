import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  LOCAL_EDIT,
  readShared,
  writeShared,
  canEdit,
  type Presence,
  type ProjectRole,
} from "./shared-document";
import type { DesignDocument } from "./document";
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function encode(data: Uint8Array) {
  let text = "";
  for (let i = 0; i < data.length; i += 8192)
    text += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(text);
}
export class CollaborationClient {
  readonly doc = new Y.Doc();
  readonly undoManager: Y.UndoManager;
  private socket: WebSocket | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private pending = 0;
  private ready = false;
  private lastAwareness: {
    selected: string | null;
    cursor?: { x: number; y: number } | null;
  } = { selected: null };
  private offline = () => {
    this.ready = false;
    this.socket?.close();
    this.callbacks.status("Offline changes queued");
    this.callbacks.presence([]);
  };
  private online = () => {
    clearTimeout(this.retry);
    void this.connect();
  };
  constructor(
    readonly projectId: string,
    readonly userId: string,
    readonly role: ProjectRole,
    private callbacks: {
      document: (d: DesignDocument) => void;
      status: (s: string) => void;
      presence: (p: Presence[]) => void;
      history: (undo: boolean, redo: boolean) => void;
      event: (event: string) => void;
      error: (s: string) => void;
      revoked: () => void;
    },
  ) {
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.online);
    this.undoManager = new Y.UndoManager(
      [
        this.doc.getMap("meta"),
        this.doc.getMap("elements"),
        this.doc.getArray("order"),
        this.doc.getMap("references"),
        this.doc.getArray("referenceOrder"),
      ],
      { trackedOrigins: new Set([LOCAL_EDIT]), captureTimeout: 400 },
    );
    const history = () => {
      while (this.undoManager.undoStack.length > 100)
        this.undoManager.undoStack.shift();
      callbacks.history(this.undoManager.canUndo(), this.undoManager.canRedo());
    };
    this.undoManager.on("stack-item-added", history);
    this.undoManager.on("stack-item-popped", history);
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      try {
        callbacks.document(readShared(this.doc));
      } catch {
        /* Initial shared types arrive together on sync. */
      }
      if (origin === LOCAL_EDIT || origin === this.undoManager) {
        callbacks.status("Offline changes queued");
        if (this.ready && this.socket?.readyState === WebSocket.OPEN) {
          this.pending++;
          this.socket.send(
            JSON.stringify({ type: "update", data: encode(update) }),
          );
          callbacks.status("Saving shared changes…");
        }
      }
    });
    if (canEdit(role)) {
      this.persistence = new IndexeddbPersistence(
        `ranga-shared-${userId}-${projectId}`,
        this.doc,
      );
      void this.persistence.whenSynced.then(() => this.connect());
    } else this.connect();
  }
  private async connect() {
    if (this.stopped) return;
    if (!navigator.onLine) {
      this.callbacks.status("Offline changes queued");
      return;
    }
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) return;
    this.callbacks.status("Connecting…");
    try {
      const health = await fetch("/api/health").then((r) => r.json());
      if (this.stopped) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:${health.websocketPort}/collaboration?project=${this.projectId}`,
      );
      this.socket = ws;
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "sync") {
            Y.applyUpdate(this.doc, decode(message.data), "remote");
            this.ready = true;
            ws.send(
              JSON.stringify({ type: "presence", ...this.lastAwareness }),
            );
            this.pending = 0;
            if (canEdit(this.role)) {
              const diff = Y.encodeStateAsUpdate(
                this.doc,
                decode(message.vector),
              );
              if (diff.length > 2) {
                this.pending++;
                ws.send(JSON.stringify({ type: "update", data: encode(diff) }));
              }
            }
            this.callbacks.status(
              this.pending ? "Saving shared changes…" : "Saved to local server",
            );
          } else if (message.type === "update") {
            Y.applyUpdate(this.doc, decode(message.data), "remote");
          } else if (message.type === "ack") {
            this.pending = Math.max(0, this.pending - 1);
            if (!this.pending) this.callbacks.status("Saved to local server");
          } else if (message.type === "presence")
            this.callbacks.presence(message.people);
          else if (message.type === "event")
            this.callbacks.event(message.event);
          else if (message.type === "error")
            this.callbacks.error(message.message);
        } catch {
          this.callbacks.error(
            "A collaboration message could not be read. Reopen the project to recover.",
          );
        }
      };
      ws.onclose = (event) => {
        this.ready = false;
        if (this.stopped) return;
        if (event.code === 1008) {
          this.stopped = true;
          this.callbacks.revoked();
          return;
        }
        this.callbacks.status("Offline changes queued");
        this.callbacks.presence([]);
        this.retry = setTimeout(() => void this.connect(), 1500);
      };
      ws.onerror = () => ws.close();
    } catch {
      if (!this.stopped) {
        this.callbacks.status("Collaboration service unavailable");
        this.retry = setTimeout(() => void this.connect(), 2000);
      }
    }
  }
  change(next: DesignDocument, previous: DesignDocument) {
    if (
      !canEdit(this.role) ||
      (!this.ready && this.doc.getMap("meta").size === 0)
    )
      throw new Error("Wait for the shared document to connect.");
    writeShared(this.doc, next, previous, LOCAL_EDIT);
  }
  awareness(selected: string | null, cursor?: { x: number; y: number } | null) {
    this.lastAwareness = { selected, cursor };
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "presence", selected, cursor }));
  }
  undo() {
    this.undoManager.undo();
  }
  redo() {
    this.undoManager.redo();
  }
  get synced() {
    return this.ready && this.pending === 0;
  }
  destroy() {
    this.stopped = true;
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.online);
    clearTimeout(this.retry);
    this.socket?.close();
    this.undoManager.destroy();
    void this.persistence?.destroy();
    this.doc.destroy();
  }
}
