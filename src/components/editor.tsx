"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  ScanEye,
  Undo2,
  Redo2,
  Download,
  Type,
  Square,
  Circle,
  ImagePlus,
  Layers3,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  Check,
  Plus,
  Minus,
  Maximize,
  History as HistoryIcon,
  Palette,
  PanelLeftClose,
  PanelRightClose,
  MessageSquare,
  Bookmark,
  ArrowUpRight,
} from "lucide-react";
import { CanvasView, type CanvasHandle } from "./canvas-view";
import { Properties } from "./properties";
import {
  createDocument,
  newLayer,
  documentSchema,
  discoveryQuerySchema,
  History,
  type DesignDocument,
  type Layer,
  type BrandKit,
  defaultBrand,
} from "@/lib/document";
import {
  loadProject,
  saveProject,
  loadBrand,
  type SavedProject,
} from "@/lib/storage";
import { readImage, download, safeFilename } from "@/lib/files";
import { api, post, imageData, type Session } from "@/lib/api";
import { CollaborationClient } from "@/lib/collaboration-client";
import {
  canEdit,
  type ProjectRole,
  type Presence,
} from "@/lib/shared-document";
import { ThemeToggle } from "./theme-toggle";
import { TeamPanel } from "./team-panel";
import { CreativeHandoff } from "./creative-handoff";
import { ReferenceBoard } from "./reference-board";
import {
  ReferenceDestinationPicker,
  type ReferenceDestination,
} from "./reference-destination";
import {
  validateReferenceImport,
  type Reference,
} from "@/lib/reference-import";
import { buildPrompt } from "@/lib/design-recipe";
import "@/lib/desktop-bridge";
type Tab =
  "elements" | "references" | "brand" | "versions" | "assistant" | "team";
export default function Editor() {
  const query = useSearchParams();
  const router = useRouter();
  const sharedId = query.get("shared");
  const collaboration = useRef<CollaborationClient | null>(null);
  const access = useRef<ProjectRole>("owner");
  const [role, setRole] = useState<ProjectRole>("owner");
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamSection, setTeamSection] = useState<"comments" | "sharing">(
    "comments",
  );
  const [people, setPeople] = useState<Presence[]>([]);
  const [eventVersion, setEventVersion] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentPoint, setCommentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const editable = canEdit(role);

  const [doc, setDoc] = useState<DesignDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("elements");
  const [versions, setVersions] = useState<SavedProject["versions"]>([]);
  const [brand, setBrand] = useState<BrandKit>(defaultBrand);
  const [status, setStatus] = useState("Opening…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [referenceOnly, setReferenceOnly] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const referencePending = useRef(false);
  const referenceEpoch = useRef(0);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const history = useRef<History<DesignDocument> | null>(null);
  const canvas = useRef<CanvasHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const replacing = useRef<string | null>(null);
  const current = useRef<DesignDocument | null>(null);
  const currentVersions = useRef<SavedProject["versions"]>([]);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const savedSnapshot = useRef<{
    document: DesignDocument;
    versions: SavedProject["versions"];
  } | null>(null);
  const [opening] = useState(() => ({
    id: query.get("id"),
    template: query.get("new"),
    sharedId: query.get("shared"),
  }));
  useEffect(() => {
    let disposed = false;
    const epoch = ++referenceEpoch.current;
    async function open() {
      await Promise.resolve();
      if (disposed) return;
      try {
        let initial: DesignDocument;
        const { id, sharedId } = opening;
        if (sharedId) {
          const result = await api<{
            document: DesignDocument;
            role: ProjectRole;
            user: { id: string };
          }>(`/api/projects/${sharedId}`);
          if (disposed) return;
          initial = result.document;
          access.current = result.role;
          setRole(result.role);
          setCurrentUserId(result.user.id);
          collaboration.current = new CollaborationClient(
            sharedId,
            result.user.id,
            result.role,
            {
              document: (value) => {
                current.current = value;
                setDoc(value);
              },
              status: setStatus,
              presence: setPeople,
              history: (canUndo, canRedo) =>
                setHistoryState({ canUndo, canRedo }),
              event: (event) => {
                setEventVersion((v) => v + 1);
                if (event === "comments")
                  setNotice("Comments updated in Team.");
              },
              error: setError,
              revoked: () => {
                access.current = "viewer";
                setRole("viewer");
                setDoc(null);
                setError(
                  "This shared session ended because access changed or an update was rejected. Reopen the project after checking your access.",
                );
              },
            },
          );
        } else if (id) {
          const stored = await loadProject(id);
          if (disposed) return;
          if (!stored)
            throw new Error(
              "This project is not in this browser. Open Projects or import a backup.",
            );
          initial = stored.document;
          setVersions(stored.versions);
          currentVersions.current = stored.versions;
        } else {
          initial = createDocument(opening.template ?? "blank");
          window.history.replaceState(null, "", `/editor?id=${initial.id}`);
        }
        if (window.innerWidth <= 1050) setLeftOpen(false);
        if (window.innerWidth <= 720) {
          setRightOpen(false);
        }
        current.current = initial;
        history.current = new History(structuredClone(initial));
        setDoc(initial);
        const kit = await loadBrand();
        if (!disposed) setBrand(kit);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not open this project.",
        );
      }
    }
    void open();
    return () => {
      disposed = true;
      referenceEpoch.current = epoch + 1;
      collaboration.current?.destroy();
      collaboration.current = null;
    };
  }, [opening]);
  useEffect(() => {
    if (!sharedId || !editable || !doc || status !== "Saved to local server")
      return;
    const timer = setTimeout(() => {
      const src = canvas.current?.thumbnail();
      if (src)
        void api(`/api/projects/${sharedId}/thumbnail`, {
          method: "PUT",
          body: JSON.stringify({ src, revision: doc.updatedAt }),
        }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [doc, editable, sharedId, status]);
  const commit = useCallback((next: DesignDocument) => {
    if (!canEdit(access.current)) return;
    try {
      const valid = documentSchema.parse({
        ...next,
        updatedAt: new Date().toISOString(),
      });
      if (collaboration.current) {
        collaboration.current.change(valid, current.current!);
        return;
      }
      history.current?.push(valid);
      setHistoryState({
        canUndo: history.current?.canUndo ?? false,
        canRedo: history.current?.canRedo ?? false,
      });
      current.current = valid;
      setDoc(valid);
      setStatus("Unsaved changes");
    } catch {
      setError("That edit exceeds the supported document limits.");
    }
  }, []);
  // Publish only first-party project metadata and the existing deterministic
  // prompt. No canvas binaries, sessions, or remote website contents cross IPC.
  useEffect(() => {
    window.rangaBridge?.context(
      doc
        ? {
            key: sharedId ? `shared:${sharedId}` : `local:${doc.id}`,
            name: doc.title,
            query: doc.discoveryQuery ?? "",
            prompt: buildPrompt({ ...doc, discoveryQuery: undefined }),
            editable,
          }
        : null,
    );
  }, [doc, sharedId, editable]);
  useEffect(() => {
    const bridge = window.rangaBridge;
    if (!bridge) return;
    const unsubscribe = bridge.subscribe((event) => {
      const latest = current.current;
      if (!latest) return;
      const key = sharedId ? `shared:${sharedId}` : `local:${latest.id}`;
      if (event.key !== key) return;
      if (event.type === "references") {
        setTab("references");
        setLeftOpen(true);
      } else if (
        event.type === "layout" &&
        typeof event.referenceOnly === "boolean"
      ) {
        setReferenceOnly(event.referenceOnly);
        if (event.referenceOnly) {
          setTab("references");
          setLeftOpen(true);
        }
      } else if (event.type === "query" && canEdit(access.current)) {
        const parsed = discoveryQuerySchema.safeParse(event.query);
        if (parsed.success) commit({ ...latest, discoveryQuery: parsed.data });
      }
    });
    return () => {
      unsubscribe();
      bridge.context(null);
    };
  }, [commit, sharedId]);
  const save = useCallback(async () => {
    const latest = current.current;
    if (!latest) return false;
    if (collaboration.current) {
      if (collaboration.current.synced) return true;
      setError(
        "Shared changes are still syncing. Wait for the connection before leaving.",
      );
      return false;
    }
    setStatus("Saving…");
    const savedVersions = currentVersions.current;
    const payload: SavedProject = {
      document: structuredClone(latest),
      thumbnail: canvas.current?.thumbnail() ?? "",
      versions: structuredClone(currentVersions.current),
    };
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() => saveProject(payload));
    try {
      await saveChain.current;
      savedSnapshot.current = { document: latest, versions: savedVersions };
      if (current.current?.updatedAt === latest.updatedAt)
        setStatus("Saved on this device");
      return true;
    } catch {
      setStatus("Save failed");
      setError(
        "The browser could not save this project. Export a project backup now. Storage may be full or disabled.",
      );
      return false;
    }
  }, []);
  async function addReference(reference: Reference, expectedKey: string) {
    if (referencePending.current)
      throw new Error("Wait for the current reference action to finish.");
    const epoch = referenceEpoch.current;
    function activeProject() {
      const latest = current.current;
      const key = sharedId ? `shared:${sharedId}` : `local:${latest?.id}`;
      if (!latest || epoch !== referenceEpoch.current || key !== expectedKey)
        throw new Error(
          "The destination changed. Preview the reference in the intended project again.",
        );
      if (!canEdit(access.current))
        throw new Error("You no longer have permission to edit this project.");
      if (latest.references.length >= 12)
        throw new Error("Keep up to 12 references per project.");
      return latest;
    }
    let valid = validateReferenceImport(reference);
    activeProject();
    referencePending.current = true;
    setReferenceBusy(true);
    try {
      if (sharedId && valid.src) {
        const { src } = await post<{ src: string }>(
          `/api/projects/${sharedId}/assets`,
          { src: valid.src },
        );
        valid = { ...valid, src };
      }
      // An upload can overlap a remote edit or role change. Merge into the
      // latest document and recheck the destination and access after awaiting.
      const latest = activeProject();
      const next = documentSchema.parse({
        ...latest,
        references: [...latest.references, valid],
      });
      commit(next);
    } finally {
      referencePending.current = false;
      if (epoch === referenceEpoch.current) setReferenceBusy(false);
    }
  }
  async function chooseReferenceDestination(destination: ReferenceDestination) {
    if (referencePending.current)
      throw new Error("Wait for the current reference action to finish.");
    if (destination.readOnly) throw new Error("Choose a project you can edit.");
    referencePending.current = true;
    setReferenceBusy(true);
    try {
      if (!(await save()))
        throw new Error(
          "The current project must finish saving before switching.",
        );
      // A full navigation gives the destination its own editor lifetime and
      // clears temporary previews. Project data stays in the existing stores.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Intentionally reset the editor lifetime and all temporary import data for this destination.
      window.location.assign(
        `/editor?${destination.shared ? "shared" : "id"}=${encodeURIComponent(destination.id)}`,
      );
    } finally {
      referencePending.current = false;
      setReferenceBusy(false);
    }
  }
  useEffect(() => {
    if (!doc || sharedId) return;
    const timer = setTimeout(() => void save(), 500);
    return () => clearTimeout(timer);
  }, [doc, versions, save, sharedId]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      // Use the acknowledged snapshot, not a render's possibly stale status.
      // A destination switch can navigate immediately after save() resolves.
      const persisted = collaboration.current
        ? collaboration.current.synced
        : savedSnapshot.current?.document === current.current &&
          savedSnapshot.current?.versions === currentVersions.current;
      if (current.current && !persisted) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const patch = (changes: Partial<DesignDocument>) => {
    if (doc) commit({ ...doc, ...changes });
  };
  const layer = doc?.layers.find((l) => l.id === selected);
  const updateLayer = (changes: Partial<Layer>) => {
    if (doc && layer && !layer.locked)
      commit({
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === selected ? { ...l, ...changes } : l,
        ),
      });
  };
  function add(type: Layer["type"], overrides: Partial<Layer> = {}) {
    const activeDocument = current.current;
    if (!activeDocument) return;
    const item = newLayer(type, {
      x: activeDocument.width * 0.12,
      y: activeDocument.height * 0.12,
      width: Math.min(520, activeDocument.width * 0.7),
      ...overrides,
    });
    commit({ ...activeDocument, layers: [...activeDocument.layers, item] });
    setSelected(item.id);
  }
  function remove() {
    if (!doc || !layer || layer.locked) return;
    commit({ ...doc, layers: doc.layers.filter((l) => l.id !== selected) });
    setSelected(null);
  }
  function duplicate() {
    if (!doc || !layer || layer.locked) return;
    const copy = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name.slice(0, 110)} copy`,
      x: layer.x + 24,
      y: layer.y + 24,
    };
    commit({ ...doc, layers: [...doc.layers, copy] });
    setSelected(copy.id);
  }
  function undo() {
    if (collaboration.current) {
      collaboration.current.undo();
      return;
    }
    const prev = history.current?.undo();
    if (prev) {
      current.current = prev;
      setDoc(prev);
      setHistoryState({
        canUndo: history.current?.canUndo ?? false,
        canRedo: history.current?.canRedo ?? false,
      });
      setStatus("Unsaved changes");
    }
  }
  function redo() {
    if (collaboration.current) {
      collaboration.current.redo();
      return;
    }
    const next = history.current?.redo();
    if (next) {
      current.current = next;
      setDoc(next);
      setHistoryState({
        canUndo: history.current?.canUndo ?? false,
        canRedo: history.current?.canRedo ?? false,
      });
      setStatus("Unsaved changes");
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches('input,textarea,select,[contenteditable="true"]'))
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setExportOpen(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function upload(file: File) {
    try {
      setError("");
      const image = await readImage(file);
      if (sharedId)
        image.src = (
          await post<{ src: string }>(`/api/projects/${sharedId}/assets`, {
            src: image.src,
          })
        ).src;
      if (!current.current) return;
      const ratio = Math.min(
        1,
        (current.current.width * 0.65) / image.width,
        (current.current.height * 0.65) / image.height,
      );
      if (replacing.current) {
        const id = replacing.current;
        commit({
          ...current.current,
          layers: current.current.layers.map((l) =>
            l.id === id
              ? {
                  ...l,
                  src: image.src,
                  width: image.width * ratio,
                  height: image.height * ratio,
                }
              : l,
          ),
        });
      } else
        add("image", {
          name: file.name.slice(0, 120),
          src: image.src,
          width: image.width * ratio,
          height: image.height * ratio,
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      replacing.current = null;
    }
  }
  async function exportFile(kind: "png" | "jpeg" | "svg" | "json") {
    if (!doc) return;
    try {
      const name = safeFilename(doc.title);
      if (kind === "png") download(canvas.current!.png(), `${name}.png`);
      if (kind === "jpeg") download(canvas.current!.jpeg(), `${name}.jpg`);
      if (kind === "svg")
        download(
          new Blob([canvas.current!.svg()], { type: "image/svg+xml" }),
          `${name}.svg`,
        );
      if (kind === "json")
        download(
          new Blob([JSON.stringify(await portableDocument(doc), null, 2)], {
            type: "application/json",
          }),
          `${name}.ranga.json`,
        );
      setExportOpen(false);
      setNotice(`${kind.toUpperCase()} exported.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }
  async function portableDocument(value: DesignDocument) {
    const copy = structuredClone(value);
    for (const item of [...copy.layers, ...copy.references])
      if (item.src?.startsWith("/api/assets/"))
        item.src = await imageData(item.src);
    return copy;
  }
  async function checkpoint() {
    if (sharedId) {
      if (!collaboration.current?.synced)
        throw new Error(
          "Wait for shared changes to finish syncing before saving a version.",
        );
      await post(`/api/projects/${sharedId}/versions`);
      setNotice("Shared version saved.");
      return;
    }
    if (!doc) return;
    const snapshot = {
      id: crypto.randomUUID(),
      name: `Version ${versions.length + 1}`,
      createdAt: new Date().toISOString(),
      document: structuredClone(doc),
    };
    const next = [snapshot, ...versions].slice(0, 20);
    currentVersions.current = next;
    setVersions(next);
    setStatus("Unsaved changes");
    setNotice("Version saved. You can restore it from History.");
  }
  useEffect(() => {
    collaboration.current?.awareness(selected);
  }, [selected]);
  async function publishShared() {
    try {
      const session = await api<Session>("/api/auth/get-session");
      if (!session) {
        setError(
          "Sign in to Ranga before sharing. Your local project stays on this device.",
        );
        return;
      }
      await save();
      const { id } = await post<{ id: string }>("/api/projects", {
        document: current.current,
      });
      router.push(`/editor?shared=${id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create shared project.",
      );
    }
  }
  if (!doc)
    return (
      <main className="message-page">
        <Link className="wordmark" href="/projects">
          Ranga.
        </Link>
        <p role={error ? "alert" : "status"}>
          {error || "Preparing your canvas…"}
        </p>
        {error && (
          <Link className="button button-dark" href="/projects">
            Back to projects
          </Link>
        )}
      </main>
    );
  return (
    <div
      className={`editor ${leftOpen && !previewMode ? "" : "left-closed"} ${rightOpen && !previewMode ? "" : "right-closed"} ${editable ? "" : "read-only"} ${referenceOnly ? "reference-only" : ""}`}
    >
      <header className="editor-top">
        <Link
          href="/projects"
          className="icon-button"
          aria-label="Back to projects"
          onClick={async (e) => {
            e.preventDefault();
            if (await save()) router.push("/projects");
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <Link
          href="/"
          className="wordmark"
          onClick={async (e) => {
            e.preventDefault();
            if (await save()) router.push("/");
          }}
        >
          Ranga.
        </Link>
        <span className="toolbar-divider" />
        <input
          disabled={!editable}
          className="project-name"
          aria-label="Project title"
          value={doc.title}
          maxLength={120}
          onChange={(e) => {
            if (e.target.value.trim()) patch({ title: e.target.value });
          }}
        />
        <span className="save-status" role="status">
          {status === "Saved on this device" && <Check size={13} />} {status}
        </span>
        <ThemeToggle />
        <div className="history-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!editable || !historyState.canUndo}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!editable || !historyState.canRedo}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <button
          disabled={!editable}
          className="button button-outline save-version"
          onClick={() => void checkpoint().catch((e) => setError(e.message))}
        >
          <Bookmark size={14} /> Save version
        </button>
        <div className="presence-avatars" aria-label="Active collaborators">
          {people.map((p) => (
            <span key={p.connectionId} title={`${p.name} (${p.role})`}>
              {p.name.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="Preview design"
          aria-pressed={previewMode}
          onClick={() => setPreviewMode(!previewMode)}
        >
          <ScanEye size={18} />
        </button>
        <button
          className="button button-outline"
          onClick={() => {
            if (sharedId) {
              setTeamSection("sharing");
              setTab("team");
              setLeftOpen(true);
              setPreviewMode(false);
            } else setShareOpen(!shareOpen);
          }}
        >
          <Users size={15} /> Share
        </button>
        {shareOpen && !sharedId && (
          <section className="share-popover">
            <h3>Make space for your team.</h3>
            <p>
              Create a shared copy on this local server. Your original browser
              project stays here.
            </p>
            <button
              className="button button-accent full-width"
              onClick={() => void publishShared()}
            >
              Create shared copy
            </button>
            <Link className="text-link" href="/login" target="_blank">
              Sign in to Ranga
            </Link>
            <button className="text-link" onClick={() => setShareOpen(false)}>
              Close
            </button>
          </section>
        )}
        <div className="export-control">
          <button
            className="button button-accent"
            onClick={() => setExportOpen(!exportOpen)}
            aria-expanded={exportOpen}
          >
            <Download size={15} /> Export
          </button>
          {exportOpen && (
            <div className="export-menu">
              <button onClick={() => exportFile("png")}>
                PNG image <span>Full resolution</span>
              </button>
              <button onClick={() => exportFile("jpeg")}>
                JPEG image <span>Full resolution</span>
              </button>
              <button onClick={() => exportFile("svg")}>
                SVG graphic <span>Text, shapes & images</span>
              </button>
              <button onClick={() => exportFile("json")}>
                Ranga project <span>Editable backup</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="editor-subbar">
        <div>
          <button
            className="icon-button"
            title="Toggle tools"
            aria-label="Toggle tools"
            aria-pressed={leftOpen}
            onClick={() => {
              setLeftOpen(!leftOpen);
              if (window.innerWidth <= 720) setRightOpen(false);
            }}
          >
            <PanelLeftClose size={16} />
          </button>
          <span>DESIGN WORKSPACE</span>
        </div>
        <span className="canvas-dimensions">
          {doc.width} × {doc.height} PX <i /> {doc.layers.length} LAYERS
        </span>
        <span className="mobile-save-status" role="status">
          {status === "Saved on this device" ? "Saved locally" : status}
        </span>
        <button
          className="icon-button"
          title="Toggle properties"
          aria-label="Toggle properties"
          aria-pressed={rightOpen}
          onClick={() => {
            setRightOpen(!rightOpen);
            if (window.innerWidth <= 720) setLeftOpen(false);
          }}
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      <aside className="editor-left">
        <div className="tool-tabs">
          {(
            [
              { id: "elements", icon: Plus, label: "Elements" },
              { id: "references", icon: ImagePlus, label: "References" },
              { id: "brand", icon: Palette, label: "Brand" },
              { id: "versions", icon: HistoryIcon, label: "History" },
              { id: "assistant", icon: MessageSquare, label: "Creative tools" },
              ...(sharedId
                ? [{ id: "team" as const, icon: Users, label: "Team" }]
                : []),
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => {
                if (t.id === "team") setTeamSection("comments");
                setTab(t.id);
              }}
              aria-label={t.label}
              title={t.label}
            >
              <t.icon size={19} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="left-panel-content">
          {tab === "elements" && (
            <>
              <fieldset disabled={!editable}>
                <div className="panel-heading">
                  <h2>Make your mark</h2>
                </div>
                <p className="panel-description">
                  The building blocks of a good idea.
                </p>
                <div className="element-grid">
                  <button onClick={() => add("text")}>
                    <Type size={23} />
                    <span>Text</span>
                  </button>
                  <button
                    onClick={() =>
                      add("rect", { width: 220, height: 220, fill: "#bd442d" })
                    }
                  >
                    <Square size={21} />
                    <span>Rectangle</span>
                  </button>
                  <button
                    onClick={() =>
                      add("ellipse", {
                        width: 220,
                        height: 220,
                        fill: "#bd442d",
                      })
                    }
                  >
                    <Circle size={21} />
                    <span>Ellipse</span>
                  </button>
                  <button
                    onClick={() => {
                      replacing.current = null;
                      fileInput.current?.click();
                    }}
                  >
                    <ImagePlus size={21} />
                    <span>Image / logo</span>
                  </button>
                </div>
                <p className="quiet-note">PNG, JPG, WebP · Up to 5 MB</p>
              </fieldset>
              <div className="panel-heading layer-heading">
                <h2>
                  <Layers3 size={15} /> Layers
                </h2>
                <span>{doc.layers.length}</span>
              </div>
              {doc.layers.length === 0 ? (
                <p className="panel-description">
                  Your first layer starts here. Add text, a shape, or an image
                  above.
                </p>
              ) : (
                <div className="layer-list">
                  {[...doc.layers].reverse().map((l) => (
                    <div
                      className={`layer-row ${selected === l.id ? "selected" : ""}`}
                      key={l.id}
                    >
                      <button
                        className="layer-select"
                        onClick={() => {
                          setSelected(l.id);
                          canvas.current?.select(l.id);
                        }}
                        aria-pressed={selected === l.id}
                      >
                        {l.type === "text" ? (
                          <Type size={14} />
                        ) : l.type === "image" ? (
                          <ImagePlus size={14} />
                        ) : l.type === "ellipse" ? (
                          <Circle size={14} />
                        ) : (
                          <Square size={14} />
                        )}
                        <span>{l.name}</span>
                      </button>
                      <button
                        className="layer-action"
                        disabled={!editable}
                        aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                        onClick={() =>
                          patch({
                            layers: doc.layers.map((item) =>
                              item.id === l.id
                                ? { ...item, visible: !item.visible }
                                : item,
                            ),
                          })
                        }
                      >
                        {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        className="layer-action"
                        disabled={!editable}
                        aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`}
                        onClick={() =>
                          patch({
                            layers: doc.layers.map((item) =>
                              item.id === l.id
                                ? { ...item, locked: !item.locked }
                                : item,
                            ),
                          })
                        }
                      >
                        {l.locked ? (
                          <LockKeyhole size={12} />
                        ) : (
                          <LockKeyholeOpen size={12} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === "references" && (
            <>
              {referenceOnly && (
                <div className="reference-save-state">
                  <span role="status">{status}</span>
                  {error && (
                    <p role="alert" className="error-banner">
                      {error}
                    </p>
                  )}
                </div>
              )}
              <ReferenceBoard
                document={doc}
                readOnly={!editable}
                compact={referenceOnly}
                projectKey={sharedId ? `shared:${sharedId}` : `local:${doc.id}`}
                onChange={(references) => patch({ references })}
                onDirection={(direction) => patch({ direction })}
                onAdd={addReference}
                destination={
                  <ReferenceDestinationPicker
                    current={{
                      key: sharedId ? `shared:${sharedId}` : `local:${doc.id}`,
                      id: sharedId ?? doc.id,
                      shared: !!sharedId,
                      title: doc.title,
                      readOnly: !editable,
                    }}
                    disabled={referenceBusy}
                    onSelect={chooseReferenceDestination}
                  />
                }
              />
            </>
          )}
          {tab === "versions" && sharedId && (
            <TeamPanel
              initialSection="history"
              key="history"
              projectId={sharedId}
              role={role}
              selected={selected}
              people={people}
              eventVersion={eventVersion}
              onLocate={(id, point) => {
                setSelected(id);
                setCommentPoint(point);
                if (id) canvas.current?.select(id);
              }}
            />
          )}
          {tab === "brand" && (
            <>
              <div className="panel-heading">
                <h2>{brand.name}</h2>
              </div>
              <p className="panel-description">
                A familiar palette. A consistent voice.
              </p>
              <div className="brand-swatches">
                <span style={{ background: brand.primary }} />
                <span style={{ background: brand.secondary }} />
              </div>
              <p className="quiet-note">
                {brand.primary} / {brand.secondary}
                <br />
                {brand.font}
              </p>
              <button
                className="button button-dark full-width"
                disabled={!editable}
                onClick={() => {
                  patch({
                    background: brand.secondary,
                    layers: doc.layers.map((l) =>
                      l.type === "text"
                        ? { ...l, fontFamily: brand.font }
                        : l.type === "rect" || l.type === "ellipse"
                          ? { ...l, fill: brand.primary }
                          : l,
                    ),
                  });
                  setNotice(
                    "Brand font, shape color, and background applied. Undo is available.",
                  );
                }}
              >
                Apply brand to design
              </button>
              {brand.logo && (
                <button
                  className="button button-outline full-width"
                  disabled={!editable}
                  onClick={async () => {
                    try {
                      const src = sharedId
                        ? (
                            await post<{ src: string }>(
                              `/api/projects/${sharedId}/assets`,
                              { src: brand.logo },
                            )
                          ).src
                        : brand.logo!;
                      const image = new window.Image();
                      image.onload = () =>
                        add("image", {
                          src,
                          name: "Brand logo",
                          width: 180,
                          height: (180 * image.height) / image.width,
                        });
                      image.src = await imageData(src);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not add brand logo.",
                      );
                    }
                  }}
                >
                  Add brand logo
                </button>
              )}
              <Link
                href="/brand"
                className="text-link"
                onClick={async (e) => {
                  e.preventDefault();
                  if (await save()) router.push("/brand");
                }}
              >
                Edit brand kit <ArrowUpRight size={14} />
              </Link>
            </>
          )}
          {tab === "versions" && !sharedId && (
            <>
              <div className="panel-heading">
                <h2>Room to explore</h2>
              </div>
              <p className="panel-description">
                Save a moment before taking a new direction. The latest 20
                versions stay with this project.
              </p>
              <button
                className="button button-outline full-width"
                onClick={() =>
                  void checkpoint().catch((e) => setError(e.message))
                }
              >
                <Plus size={15} /> Save a version
              </button>
              {versions.length === 0 ? (
                <p className="quiet-note">
                  No snapshots yet. Autosave keeps your current work; snapshots
                  keep earlier directions.
                </p>
              ) : (
                versions.map((v) => (
                  <div className="version-row" key={v.id}>
                    <div>
                      <strong>{v.name}</strong>
                      <p>{new Date(v.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => {
                        if (
                          confirm(
                            `Restore ${v.name}? Your current edits remain available with Undo.`,
                          )
                        ) {
                          commit({ ...v.document, id: doc.id });
                          setSelected(null);
                        }
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </>
          )}
          {tab === "assistant" && (
            <CreativeHandoff
              document={doc}
              readOnly={!editable}
              onChange={commit}
              onImport={async (next) => {
                try {
                  await checkpoint();
                  commit({
                    ...current.current!,
                    title: next.title,
                    width: next.width,
                    height: next.height,
                    background: next.background,
                    layers: next.layers,
                  });
                  setNotice(
                    "Validated design imported. A previous version was saved.",
                  );
                  return true;
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not save a version before importing.",
                  );
                  return false;
                }
              }}
              onImage={() => fileInput.current?.click()}
            />
          )}
          {tab === "team" && sharedId && (
            <TeamPanel
              key={teamSection}
              initialSection={teamSection}
              projectId={sharedId}
              role={role}
              selected={selected}
              people={people}
              eventVersion={eventVersion}
              onLocate={(id, point) => {
                setSelected(id);
                setCommentPoint(point);
                if (id) canvas.current?.select(id);
              }}
            />
          )}
        </div>
        <div className="panel-foot">
          <span className="status-dot" /> LOCAL PREVIEW
        </div>
      </aside>
      <main className="editor-center">
        {error && (
          <div role="alert" className="editor-alert error-banner">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="editor-alert">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        <CanvasView
          commentPoint={commentPoint}
          ref={canvas}
          document={doc}
          editable={editable && !previewMode}
          people={people.filter((p) => p.userId !== currentUserId)}
          onCursor={(cursor) =>
            collaboration.current?.awareness(selected, cursor)
          }
          selected={selected}
          zoom={zoom}
          onScale={setScale}
          onChange={(layers) => commit({ ...current.current!, layers })}
          onSelect={setSelected}
          onError={setError}
        />
        <div className="canvas-controls">
          <span className="canvas-instruction">
            Select. Move. Make it yours.
          </span>
          <div className="zoom-control">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom(Math.max(0.15, scale - 0.1))}
            >
              <Minus size={14} />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom(Math.min(2, scale + 0.1))}
            >
              <Plus size={14} />
            </button>
            <span className="toolbar-divider" />
            <button aria-label="Fit canvas" onClick={() => setZoom(null)}>
              <Maximize size={14} />
            </button>
          </div>
        </div>
      </main>
      <aside className="editor-right">
        <fieldset disabled={!editable}>
          <Properties
            layer={layer}
            document={doc}
            onChange={updateLayer}
            onDocument={patch}
            onDuplicate={duplicate}
            onDelete={remove}
            onReplace={() => {
              replacing.current = selected;
              fileInput.current?.click();
            }}
            onReorder={(direction) => {
              if (!selected) return;
              const layers = [...doc.layers];
              const index = layers.findIndex((l) => l.id === selected);
              const to = Math.max(
                0,
                Math.min(layers.length - 1, index + direction),
              );
              const [moved] = layers.splice(index, 1);
              layers.splice(to, 0, moved);
              patch({ layers });
            }}
          />
        </fieldset>
        <button
          className="canvas-properties-button"
          onClick={() => setSelected(null)}
        >
          Canvas settings <ArrowUpRight size={13} />
        </button>
      </aside>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
