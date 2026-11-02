"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Type,
  Square,
  Circle,
  ImagePlus,
  Upload,
  Layers3,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  Trash2,
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
type Tab = "elements" | "references" | "brand" | "versions" | "assistant";
export default function Editor() {
  const query = useSearchParams();
  const router = useRouter();
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
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const history = useRef<History<DesignDocument> | null>(null);
  const canvas = useRef<CanvasHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const current = useRef<DesignDocument | null>(null);
  const currentVersions = useRef<SavedProject["versions"]>([]);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    async function open() {
      try {
        let initial: DesignDocument;
        const id = query.get("id");
        if (id) {
          const stored = await loadProject(id);
          if (!stored)
            throw new Error(
              "This project is not in this browser. Open Projects or import a backup.",
            );
          initial = stored.document;
          setVersions(stored.versions);
          currentVersions.current = stored.versions;
        } else {
          initial = createDocument(query.get("new") ?? "blank");
          window.history.replaceState(null, "", `/editor?id=${initial.id}`);
        }
        if (window.innerWidth <= 1050) setLeftOpen(false);
        if (window.innerWidth <= 720) {
          setRightOpen(false);
        }
        current.current = initial;
        history.current = new History(structuredClone(initial));
        setDoc(initial);
        setBrand(await loadBrand());
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not open this project.",
        );
      }
    }
    void open();
  }, [query]);
  const commit = useCallback((next: DesignDocument) => {
    try {
      const valid = documentSchema.parse({
        ...next,
        updatedAt: new Date().toISOString(),
      });
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
  const save = useCallback(async () => {
    const latest = current.current;
    if (!latest) return false;
    setStatus("Saving…");
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
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(() => void save(), 500);
    return () => clearTimeout(timer);
  }, [doc, versions, save]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (status !== "Saved on this device") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
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
  function exportFile(kind: "png" | "svg" | "json") {
    if (!doc) return;
    try {
      const name = safeFilename(doc.title);
      if (kind === "png") download(canvas.current!.png(), `${name}.png`);
      if (kind === "svg")
        download(
          new Blob([canvas.current!.svg()], { type: "image/svg+xml" }),
          `${name}.svg`,
        );
      if (kind === "json")
        download(
          new Blob([JSON.stringify(doc, null, 2)], {
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
  function checkpoint() {
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
  async function reference(file: File) {
    try {
      const image = await readImage(file);
      const activeDocument = current.current;
      if (!activeDocument) return;
      if (activeDocument.references.length >= 12)
        throw new Error("Keep up to 12 references per project.");
      commit({
        ...activeDocument,
        references: [
          ...activeDocument.references,
          {
            id: crypto.randomUUID(),
            name: file.name.slice(0, 120),
            src: image.src,
            selected: false,
          },
        ],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add reference.");
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
      className={`editor ${leftOpen ? "" : "left-closed"} ${rightOpen ? "" : "right-closed"}`}
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
        <div className="history-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!historyState.canUndo}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!historyState.canRedo}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <button
          className="button button-outline save-version"
          onClick={checkpoint}
        >
          <Bookmark size={14} /> Save version
        </button>
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
              { id: "assistant", icon: MessageSquare, label: "Assistant" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
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
                    add("ellipse", { width: 220, height: 220, fill: "#bd442d" })
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
              <div className="panel-heading">
                <h2>Your direction</h2>
                <span>{doc.references.length}/12</span>
              </div>
              <p className="panel-description">
                Keep inspiration close. Add images you own or have permission to
                use, then select what speaks to you.
              </p>
              <button
                className="button button-outline full-width"
                onClick={() => refInput.current?.click()}
              >
                <Upload size={15} /> Add reference
              </button>
              <div className="reference-grid">
                {doc.references.map((r) => (
                  <div
                    key={r.id}
                    className={`reference-card ${r.selected ? "selected" : ""}`}
                  >
                    <button
                      aria-label={`Select reference ${r.name}`}
                      aria-pressed={r.selected}
                      onClick={() =>
                        patch({
                          references: doc.references.map((item) =>
                            item.id === r.id
                              ? { ...item, selected: !item.selected }
                              : item,
                          ),
                        })
                      }
                    >
                      <Image
                        src={r.src}
                        alt={r.name}
                        width={130}
                        height={130}
                        unoptimized
                      />
                      {r.selected && (
                        <span className="reference-check">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                    <div>
                      <span>{r.name}</span>
                      <button
                        aria-label={`Remove reference ${r.name}`}
                        onClick={() =>
                          patch({
                            references: doc.references.filter(
                              (item) => item.id !== r.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="field">
                <span>Creative direction</span>
                <textarea
                  rows={5}
                  maxLength={5000}
                  value={doc.direction}
                  onChange={(e) => patch({ direction: e.target.value })}
                  placeholder="What do you like? A color relationship, a type treatment, the space between things…"
                />
              </label>
              <p className="quiet-note">
                References stay separate from your exported design. Pinterest
                connection is planned for a later milestone.
              </p>
            </>
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
                  onClick={async () => {
                    const image = new window.Image();
                    image.onload = () =>
                      add("image", {
                        src: brand.logo,
                        name: "Brand logo",
                        width: 180,
                        height: (180 * image.height) / image.width,
                      });
                    image.src = brand.logo!;
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
          {tab === "versions" && (
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
                onClick={checkpoint}
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
            <>
              <div className="panel-heading">
                <h2>Design assistant</h2>
              </div>
              <div className="unavailable-tag">NOT CONNECTED</div>
              <h3 className="assistant-heading">
                The tools are here.
                <br />
                The conversation comes next.
              </h3>
              <p className="panel-description">
                AI editing will be connected in a later milestone. For now,
                compose with real editable layers using Elements and Properties.
              </p>
              <button
                className="button button-outline full-width"
                onClick={() => setTab("elements")}
              >
                Explore the tools <ArrowUpRight size={14} />
              </button>
              <p className="quiet-note">
                No prompts are sent to an AI service in this preview.
              </p>
            </>
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
          ref={canvas}
          document={doc}
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
      <input
        hidden
        ref={refInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void reference(file);
        }}
      />
    </div>
  );
}
