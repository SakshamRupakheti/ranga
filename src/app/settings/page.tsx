"use client";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { clearLocalData } from "@/lib/storage";
import { HardDrive, Unplug, Trash2 } from "lucide-react";
export default function Settings() {
  const [message, setMessage] = useState("");
  return (
    <Shell>
      <header className="page-top">
        <span className="eyebrow">THE WORKSPACE / SETTINGS</span>
      </header>
      <section className="page-heading">
        <div>
          <h1>A clear view of your workspace.</h1>
          <p>What is stored, what is connected, and what comes next.</p>
        </div>
      </section>
      <div className="settings-stack">
        <section className="settings-card">
          <HardDrive size={22} />
          <div>
            <h2>Local by design, for now.</h2>
            <p>
              Projects, uploaded images, reference images, versions, and your
              brand kit are stored in this browser using IndexedDB. This preview
              has no account system or cloud sync. Anyone using this browser
              profile can access these projects.
            </p>
            <p>
              Clearing browser data removes your work. Export Ranga project
              backups for designs you want to keep. A backup includes the
              current composition and references, but not version snapshots or
              your separate brand kit.
            </p>
            <p>
              No design content is sent to an AI or third-party design service.
              This development preview is not a reviewed public privacy policy.
            </p>
          </div>
        </section>
        <section className="settings-card">
          <Unplug size={22} />
          <div>
            <h2>External connections</h2>
            <p>
              As requested, service setup is deferred until the core editor is
              ready.
            </p>
            {[
              "AI assistant and image generation",
              "Pinterest reference discovery",
              "Canva interoperability",
              "Cloud accounts and project sync",
            ].map((name) => (
              <div className="connection-row" key={name}>
                <span>{name}</span>
                <span className="unavailable-tag">NOT CONFIGURED</span>
              </div>
            ))}
          </div>
        </section>
        <section className="settings-card">
          <Trash2 size={22} />
          <div>
            <h2>Delete local workspace data</h2>
            <p>
              Remove all projects, saved versions, uploads, references, and
              brand settings from this browser. Export your backups first.
            </p>
            <button
              className="button button-outline danger"
              onClick={async () => {
                if (
                  confirm(
                    "Permanently delete every Ranga project, version, reference, and brand setting from this browser? This cannot be undone.",
                  )
                ) {
                  try {
                    await clearLocalData();
                    setMessage(
                      "All Ranga workspace data in this browser has been deleted.",
                    );
                  } catch {
                    setMessage(
                      "Deletion failed. Please check your browser storage settings.",
                    );
                  }
                }
              }}
            >
              Delete all local data
            </button>
            <p role="status">{message}</p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
