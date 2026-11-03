"use client";
import { useState } from "react";
import { AccountSettings } from "@/components/account-settings";
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
        <AccountSettings />
        <section className="settings-card">
          <HardDrive size={22} />
          <div>
            <h2>Your device and your shared workspace.</h2>
            <p>
              Device projects and your brand kit are stored in this browser.
              Anyone using this browser profile can access them. Shared
              projects, uploads, accounts, comments, and versions are stored by
              the local Ranga service, with access controlled by project roles.
              Shared editing also keeps a browser cache for reconnecting.
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
            <h2>Creative tools</h2>
            <p>
              ChatGPT and Pinterest are used in your own browser sessions. Ranga
              never accesses their passwords, cookies, or extensions.
            </p>
            {[
              "ChatGPT: separate-tab shortcut and manual prompt handoff",
              "Pinterest: separate-tab shortcut and attributed references",
              "Editable JSON recipe import with validation",
            ].map((name) => (
              <div className="connection-row" key={name}>
                <span>{name}</span>
                <span className="unavailable-tag">NO EXTERNAL API</span>
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
                      "Device projects, versions, and brand settings have been deleted. Shared projects remain in your account.",
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
