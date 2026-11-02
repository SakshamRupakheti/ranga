"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  ArrowUpRight,
  Upload,
  Copy,
  Trash2,
  Pencil,
  FolderOpen,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  listProjects,
  saveProject,
  deleteProject,
  type SavedProject,
} from "@/lib/storage";
import { documentSchema } from "@/lib/document";
export default function Projects() {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  async function refresh() {
    setProjects(await listProjects());
  }
  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() =>
        setError(
          "Browser storage is unavailable. Enable site storage to save your projects.",
        ),
      )
      .finally(() => setReady(true));
  }, []);
  async function action(fn: () => Promise<void>) {
    try {
      setError("");
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update your project.",
      );
    }
  }
  return (
    <Shell>
      <header className="page-top">
        <span className="eyebrow">THE WORKSPACE</span>
        <span className="local-badge">
          <span className="status-dot" /> SAVED ON THIS DEVICE
        </span>
      </header>
      <section className="page-heading">
        <div>
          <h1>Room for your next idea.</h1>
          <p>Start something new. Pick up where you left off.</p>
        </div>
        <Link href="/editor?new=blank" className="button button-accent">
          <Plus size={17} /> New design
        </Link>
      </section>
      <section className="starting-points">
        <div className="section-label">
          <h2>A place to start</h2>
          <span>YOUR CONTENT. YOUR COMPOSITION.</span>
        </div>
        <div className="starter-grid">
          <Link className="starter blank-starter" href="/editor?new=blank">
            <div className="blank-art">
              <Plus size={28} />
            </div>
            <div>
              <h3>
                Blank canvas <ArrowUpRight size={16} />
              </h3>
              <p>Nothing in your way. 900 × 1200</p>
            </div>
          </Link>
          <Link className="starter" href="/editor?new=editorial">
            <div className="editorial-art">
              <span>
                FORM
                <br />
                <em>& FIELD</em>
              </span>
              <i />
            </div>
            <div>
              <h3>
                Editorial study <ArrowUpRight size={16} />
              </h3>
              <p>Expressive type. Quiet confidence.</p>
            </div>
          </Link>
          <Link className="starter" href="/editor?new=social">
            <div className="social-art">
              <i />
              <span>
                A fresh
                <br />
                <em>perspective.</em>
              </span>
            </div>
            <div>
              <h3>
                A fresh perspective <ArrowUpRight size={16} />
              </h3>
              <p>A square composition to make yours.</p>
            </div>
          </Link>
        </div>
      </section>
      <section className="project-section">
        <div className="section-label">
          <h2>
            Your projects <span className="count">{projects.length}</span>
          </h2>
          <button
            className="button button-outline"
            onClick={() => upload.current?.click()}
          >
            <Upload size={15} /> Import project
          </button>
          <input
            ref={upload}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file)
                void action(async () => {
                  if (file.size > 30 * 1024 * 1024)
                    throw new Error(
                      "Project backups must be smaller than 30 MB.",
                    );
                  const document = documentSchema.parse(
                    JSON.parse(await file.text()),
                  );
                  document.id = crypto.randomUUID();
                  document.updatedAt = new Date().toISOString();
                  await saveProject({ document, thumbnail: "", versions: [] });
                });
            }}
          />
        </div>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        {!ready ? (
          <p className="empty-state">Opening your workspace…</p>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={29} />
            <h3>A fresh page.</h3>
            <p>
              Your saved designs will live here. Start with a composition above,
              <br />
              or bring an editable Ranga project backup.
            </p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map(({ document: d, thumbnail }) => (
              <article className="project-card" key={d.id}>
                <Link href={`/editor?id=${d.id}`} className="project-thumbnail">
                  {thumbnail ? (
                    <Image
                      src={thumbnail}
                      alt={d.title}
                      width={260}
                      height={250}
                      unoptimized
                    />
                  ) : (
                    <span>{d.title}</span>
                  )}
                </Link>
                <div className="project-card-info">
                  <Link href={`/editor?id=${d.id}`}>
                    <h3>{d.title}</h3>
                  </Link>
                  <p>
                    {d.width} × {d.height} px ·{" "}
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="project-actions">
                    <button
                      aria-label={`Rename ${d.title}`}
                      title="Rename"
                      onClick={() => {
                        const title = prompt("Project name", d.title)?.trim();
                        if (title)
                          void action(async () => {
                            const p = projects.find(
                              (p) => p.document.id === d.id,
                            )!;
                            await saveProject({
                              ...p,
                              document: {
                                ...d,
                                title: title.slice(0, 120),
                                updatedAt: new Date().toISOString(),
                              },
                            });
                          });
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`Duplicate ${d.title}`}
                      title="Duplicate"
                      onClick={() =>
                        void action(async () => {
                          const p = projects.find(
                            (p) => p.document.id === d.id,
                          )!;
                          await saveProject({
                            ...p,
                            document: {
                              ...d,
                              id: crypto.randomUUID(),
                              title: `${d.title.slice(0, 110)} copy`,
                              updatedAt: new Date().toISOString(),
                            },
                            versions: [],
                          });
                        })
                      }
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      aria-label={`Delete ${d.title}`}
                      title="Delete"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete “${d.title}” and its saved versions from this browser?`,
                          )
                        )
                          void action(() => deleteProject(d.id));
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
