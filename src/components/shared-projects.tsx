"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, post, imageData, type Session } from "@/lib/api";
import { createDocument, type DesignDocument } from "@/lib/document";
import type { ProjectRole } from "@/lib/shared-document";
type SharedProject = {
  id: string;
  title: string;
  role: ProjectRole;
  updated_at: string;
  has_thumbnail: number;
  collaborators: number;
};
export function SharedProjects() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setProjects(
      (await api<{ projects: SharedProject[] }>("/api/projects")).projects,
    );
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update shared project.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    api<Session>("/api/auth/get-session")
      .then(async (s) => {
        setSession(s);
        if (s)
          setProjects(
            (await api<{ projects: SharedProject[] }>("/api/projects"))
              .projects,
          );
      })
      .catch(() =>
        setError(
          "The local collaboration service is offline. Browser projects below still work.",
        ),
      )
      .finally(() => setReady(true));
  }, []);
  return (
    <section className="shared-project-section">
      <div className="section-label">
        <h2>Team projects</h2>
        {session ? (
          <button
            className="button button-outline"
            onClick={async () => {
              try {
                const { id } = await post<{ id: string }>("/api/projects", {
                  document: createDocument(),
                });
                router.push(`/editor?shared=${id}`);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not create project.",
                );
              }
            }}
          >
            New shared design
          </button>
        ) : (
          <Link className="button button-outline" href="/login">
            Sign in to collaborate
          </Link>
        )}
      </div>
      {error && <p className="quiet-note">{error}</p>}
      {!ready ? (
        <p className="quiet-note">Checking shared workspace…</p>
      ) : session ? (
        <>
          <p className="quiet-note">
            Signed in as {session.user.name}. These projects are stored on the
            local collaboration server.
          </p>
          <div className="project-filters">
            <input
              className="project-search"
              aria-label="Search shared projects"
              placeholder="Find a shared project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Sort shared projects"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Recently updated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          {projects.length === 0 ? (
            <p className="quiet-note">
              No shared projects yet. Create one here or use Share in an
              existing design.
            </p>
          ) : (
            <div className="shared-project-grid">
              {projects
                .filter((p) =>
                  p.title.toLowerCase().includes(search.toLowerCase()),
                )
                .toSorted((a, b) =>
                  sort === "name"
                    ? a.title.localeCompare(b.title)
                    : b.updated_at.localeCompare(a.updated_at),
                )
                .map((p) => (
                  <div className="shared-project-card" key={p.id}>
                    <Link href={`/editor?shared=${p.id}`}>
                      <div className="shared-project-thumbnail">
                        {p.has_thumbnail ? (
                          <Image
                            unoptimized
                            src={`/api/projects/${p.id}/thumbnail?updated=${encodeURIComponent(p.updated_at)}`}
                            alt={`Preview of ${p.title}`}
                            width={400}
                            height={280}
                          />
                        ) : (
                          <span>Open canvas</span>
                        )}
                      </div>
                      <h3>{p.title}</h3>
                      <p>
                        {p.role} · {p.collaborators}{" "}
                        {p.collaborators === 1 ? "member" : "members"} ·{" "}
                        {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    </Link>
                    <div className="shared-project-actions">
                      {(p.role === "owner" || p.role === "editor") && (
                        <button
                          disabled={busy}
                          aria-label={`Rename shared ${p.title}`}
                          onClick={() => {
                            const title = prompt("Project name", p.title);
                            if (title?.trim())
                              void action(async () => {
                                await api(`/api/projects/${p.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ title: title.trim() }),
                                });
                              });
                          }}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        disabled={busy}
                        aria-label={`Duplicate shared ${p.title}`}
                        onClick={() =>
                          void action(async () => {
                            const { document } = await api<{
                              document: DesignDocument;
                            }>(`/api/projects/${p.id}`);
                            for (const item of [
                              ...document.layers,
                              ...document.references,
                            ])
                              if (item.src)
                                item.src = await imageData(item.src);
                            document.title = `${document.title.slice(0, 115)} copy`;
                            await post("/api/projects", { document });
                          })
                        }
                      >
                        Duplicate
                      </button>
                      {p.role === "owner" && (
                        <button
                          disabled={busy}
                          aria-label={`Delete shared ${p.title}`}
                          onClick={async () => {
                            if (
                              confirm(
                                `Delete shared project “${p.title}” for every collaborator?`,
                              )
                            ) {
                              try {
                                await api(`/api/projects/${p.id}`, {
                                  method: "DELETE",
                                });
                                setProjects(
                                  projects.filter((x) => x.id !== p.id),
                                );
                              } catch (e) {
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "Could not delete.",
                                );
                              }
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
          {projects.length > 0 &&
            !projects.some((p) =>
              p.title.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <p className="quiet-note">
                No shared projects match your search.
              </p>
            )}
        </>
      ) : (
        <p className="quiet-note">
          Local projects work without an account. Sign in to invite people and
          edit together.
        </p>
      )}
    </section>
  );
}
