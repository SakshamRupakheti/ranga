"use client";
import { useEffect, useState } from "react";
import { listProjects } from "@/lib/storage";
import { api, type Session } from "@/lib/api";
import { canEdit, type ProjectRole } from "@/lib/shared-document";

export type ReferenceDestination = {
  key: string;
  id: string;
  shared: boolean;
  title: string;
  readOnly: boolean;
};
export function ReferenceDestinationPicker({
  current,
  disabled,
  onSelect,
}: {
  current: ReferenceDestination;
  disabled: boolean;
  onSelect: (destination: ReferenceDestination) => Promise<void>;
}) {
  const [projects, setProjects] = useState<ReferenceDestination[]>([]);
  const [notice, setNotice] = useState("Loading destinations…");
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    let disposed = false;
    async function load() {
      const results = await Promise.allSettled([
        listProjects().then((items) =>
          items.map(({ document: doc }) => ({
            key: `local:${doc.id}`,
            id: doc.id,
            title: doc.title,
            shared: false,
            readOnly: false,
          })),
        ),
        api<Session>("/api/auth/get-session").then(async (session) => {
          if (!session) return [];
          const { projects } = await api<{
            projects: { id: string; title: string; role: ProjectRole }[];
          }>("/api/projects");
          return projects.map((project) => ({
            key: `shared:${project.id}`,
            id: project.id,
            title: project.title,
            shared: true,
            readOnly: !canEdit(project.role),
          }));
        }),
      ]);
      if (disposed) return;
      setProjects(
        results.flatMap((result) =>
          result.status === "fulfilled" ? result.value : [],
        ),
      );
      setNotice(
        results.some((result) => result.status === "rejected")
          ? "Some destinations could not load. Available projects are listed below."
          : "Choose a destination before preparing a reference.",
      );
    }
    void load();
    return () => {
      disposed = true;
    };
  }, []);
  const options = [
    current,
    ...projects.filter((project) => project.key !== current.key),
  ];
  return (
    <div className="reference-destination">
      <label className="field">
        <span>Destination project</span>
        <select
          value={current.key}
          disabled={disabled || switching}
          onChange={async (event) => {
            const destination = options.find(
              (project) => project.key === event.target.value,
            );
            if (!destination || destination.key === current.key) return;
            setSwitching(true);
            setError("");
            try {
              await onSelect(destination);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not switch projects.",
              );
            } finally {
              setSwitching(false);
            }
          }}
        >
          {options.map((project) => (
            <option
              key={project.key}
              value={project.key}
              disabled={project.readOnly && project.key !== current.key}
            >
              {project.title} · {project.shared ? "Shared" : "On this device"}
              {project.readOnly ? " · Read-only" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="quiet-note">
        {switching ? "Saving before switching…" : notice}
      </p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </div>
  );
}
