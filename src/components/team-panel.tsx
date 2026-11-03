"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import {
  canEdit,
  type ProjectRole,
  type Presence,
} from "@/lib/shared-document";
type Member = { id: string; name: string; role: ProjectRole };
type Invitation = {
  id: string;
  role: string;
  email: string | null;
  expires_at: number;
  used_by: string | null;
  revoked: number;
};
type Comment = {
  id: string;
  author_name: string;
  parent_id: string | null;
  element_id: string | null;
  body: string;
  resolved: number;
  created_at: string;
  anchor_x: number | null;
  anchor_y: number | null;
};
type Version = { id: string; author_name: string; created_at: string };
type Activity = {
  id: string;
  author_name: string;
  action: string;
  created_at: string;
};
export function TeamPanel({
  projectId,
  role,
  selected,
  people,
  eventVersion,
  initialSection = "comments",
  onLocate,
}: {
  projectId: string;
  role: ProjectRole;
  selected: string | null;
  people: Presence[];
  eventVersion: number;
  initialSection?: "comments" | "sharing" | "history";
  onLocate?: (
    elementId: string | null,
    point: { x: number; y: number } | null,
  ) => void;
}) {
  const [section, setSection] = useState<string>(initialSection);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [inviteRole, setInviteRole] = useState("editor");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [attach, setAttach] = useState(false);
  const [copied, setCopied] = useState(false);
  const [point, setPoint] = useState(false);
  const [pointX, setPointX] = useState(0),
    [pointY, setPointY] = useState(0);
  const refresh = useCallback(async () => {
    const [m, c, v, a] = await Promise.all([
      api<{ members: Member[]; invites: Invitation[] }>(
        `/api/projects/${projectId}/members`,
      ),
      api<{ comments: Comment[] }>(`/api/projects/${projectId}/comments`),
      api<{ versions: Version[] }>(`/api/projects/${projectId}/versions`),
      api<{ activity: Activity[] }>(`/api/projects/${projectId}/activity`),
    ]);
    setMembers(m.members);
    setInvites(
      m.invites.filter(
        (i) => !i.revoked && !i.used_by && i.expires_at > Date.now(),
      ),
    );
    setComments(c.comments);
    setVersions(v.versions);
    setActivity(a.activity);
  }, [projectId]);
  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch((e) => setError(e.message));
  }, [refresh, eventVersion]);
  async function action(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete action.");
    }
  }
  return (
    <>
      <div className="panel-heading">
        <h2>Your team</h2>
        <span>{role}</span>
      </div>
      <div className="team-tabs">
        {["comments", "sharing", "history"].map((s) => (
          <button
            key={s}
            className={section === s ? "active" : ""}
            onClick={() => setSection(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {section === "sharing" ? (
        <>
          <p className="panel-description">
            {people.length} active session{people.length === 1 ? "" : "s"}.
            Invitation links expire in seven days.
          </p>
          {members.map((m) => (
            <div className="member-row" key={m.id}>
              <span>
                <strong>{m.name}</strong>
                <small>{m.role}</small>
              </span>
              {role === "owner" && m.role !== "owner" && (
                <button
                  aria-label={`Revoke ${m.name}`}
                  onClick={() =>
                    void action(() =>
                      api(`/api/projects/${projectId}/members/${m.id}`, {
                        method: "DELETE",
                      }),
                    )
                  }
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
          {role === "owner" && (
            <>
              <label className="field">
                <span>Invitation role</span>
                <select
                  aria-label="Invitation role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="editor">Editor</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <label className="field">
                <span>Restrict to email (optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                className="button button-dark full-width"
                onClick={() =>
                  void action(async () => {
                    const result = await post<{ url: string }>(
                      `/api/projects/${projectId}/invitations`,
                      { role: inviteRole, email },
                    );
                    setLink(result.url);
                    setCopied(false);
                  })
                }
              >
                Create invitation link
              </button>
              {link && (
                <>
                  <label className="field">
                    <span>Invitation link</span>
                    <input readOnly value={link} />
                  </label>
                  <button
                    className="button button-outline full-width"
                    onClick={() =>
                      void action(async () => {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                      })
                    }
                  >
                    {copied ? "Copied" : "Copy invitation"}
                  </button>
                </>
              )}
              {invites.map((i) => (
                <div className="member-row" key={i.id}>
                  <span>
                    {i.email || "Anyone with link"}
                    <small>{i.role}</small>
                  </span>
                  <button
                    onClick={() =>
                      void action(() =>
                        api(`/api/projects/${projectId}/invitations/${i.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    Revoke link
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      ) : section === "comments" ? (
        <>
          {role !== "viewer" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await post(`/api/projects/${projectId}/comments`, {
                    body: text,
                    parentId: reply,
                    elementId: attach ? selected : null,
                    ...(!reply && point
                      ? { anchor: { x: pointX, y: pointY } }
                      : {}),
                  });
                  setText("");
                  setReply(null);
                });
              }}
            >
              <label className="field">
                <span>{reply ? "Reply to thread" : "Leave a note"}</span>
                <textarea
                  required
                  maxLength={3000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                />
              </label>
              {selected && !reply && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={attach}
                    onChange={(e) => setAttach(e.target.checked)}
                  />{" "}
                  Attach to selected layer
                </label>
              )}
              {!reply && (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={point}
                      onChange={(e) => setPoint(e.target.checked)}
                    />{" "}
                    Attach a canvas coordinate
                  </label>
                  {point && (
                    <div className="two-buttons">
                      <label className="field">
                        <span>Comment X</span>
                        <input
                          type="number"
                          min={0}
                          max={4096}
                          value={pointX}
                          onChange={(e) => setPointX(Number(e.target.value))}
                        />
                      </label>
                      <label className="field">
                        <span>Comment Y</span>
                        <input
                          type="number"
                          min={0}
                          max={4096}
                          value={pointY}
                          onChange={(e) => setPointY(Number(e.target.value))}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
              <button className="button button-accent full-width">
                {reply ? "Post reply" : "Post comment"}
              </button>
              {reply && (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setReply(null)}
                >
                  Cancel reply
                </button>
              )}
            </form>
          )}
          {comments
            .filter((c) => !c.parent_id)
            .map((c) => (
              <article
                className={`comment-thread ${c.resolved ? "resolved" : ""}`}
                key={c.id}
              >
                <div>
                  <strong>{c.author_name}</strong>
                  <time title={new Date(c.created_at).toLocaleString()}>
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {(c.element_id || c.anchor_x !== null) && (
                  <button
                    className="text-link"
                    onClick={() =>
                      onLocate?.(
                        c.element_id,
                        c.anchor_x !== null && c.anchor_y !== null
                          ? { x: c.anchor_x, y: c.anchor_y }
                          : null,
                      )
                    }
                  >
                    {c.element_id
                      ? "Show attached layer"
                      : `Show point ${c.anchor_x}, ${c.anchor_y}`}
                  </button>
                )}
                <p>{c.body}</p>
                {comments
                  .filter((r) => r.parent_id === c.id)
                  .map((r) => (
                    <div className="comment-reply" key={r.id}>
                      <strong>{r.author_name}</strong>
                      <p>{r.body}</p>
                    </div>
                  ))}
                <div className="comment-actions">
                  {role !== "viewer" && (
                    <>
                      <button onClick={() => setReply(c.id)}>Reply</button>
                      <button
                        onClick={() =>
                          void action(() =>
                            api(`/api/projects/${projectId}/comments/${c.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ resolved: !c.resolved }),
                            }),
                          )
                        }
                      >
                        {c.resolved ? "Reopen" : "Resolve"}
                      </button>
                    </>
                  )}
                  {!!c.resolved && <span>Resolved</span>}
                </div>
              </article>
            ))}
          {!comments.length && (
            <p className="quiet-note">
              No comments yet. Notes and replies appear live for your
              collaborators.
            </p>
          )}
        </>
      ) : (
        <>
          {canEdit(role) && (
            <button
              className="button button-outline full-width"
              onClick={() =>
                void action(() => post(`/api/projects/${projectId}/versions`))
              }
            >
              Save shared version
            </button>
          )}
          {versions.map((v) => (
            <div className="version-row" key={v.id}>
              <span>
                {v.author_name}
                <p>{new Date(v.created_at).toLocaleString()}</p>
              </span>
              {role === "owner" && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Restore this version for everyone? Save a current snapshot first if you want to keep it.",
                      )
                    )
                      void action(() =>
                        post(
                          `/api/projects/${projectId}/versions/${v.id}/restore`,
                        ),
                      );
                  }}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
          <h3 className="small-heading">Recent activity</h3>
          {activity.map((a) => (
            <div className="activity-row" key={a.id}>
              <strong>{a.author_name}</strong> {a.action.toLowerCase()}
              <small>{new Date(a.created_at).toLocaleString()}</small>
            </div>
          ))}
        </>
      )}
    </>
  );
}
