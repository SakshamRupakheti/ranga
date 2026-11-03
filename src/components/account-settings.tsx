"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, post, type Session } from "@/lib/api";
export function AccountSettings() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    api<Session>("/api/auth/get-session")
      .then(setSession)
      .catch(() => setStatus("The local account service is offline."));
  }, []);
  return (
    <section className="settings-card">
      <div>
        <h2>Your Ranga account</h2>
        {session ? (
          <>
            <p>
              Signed in as {session.user.name} ({session.user.email}). Shared
              projects live on this local server; browser-only projects remain
              separate.
            </p>
            <form
              className="account-inline"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                try {
                  await post("/api/auth/update-user", {
                    name: data.get("name"),
                  });
                  setStatus("Account name updated.");
                  setSession(await api("/api/auth/get-session"));
                } catch (e) {
                  setStatus(
                    e instanceof Error
                      ? e.message
                      : "Could not update account.",
                  );
                }
              }}
            >
              <label className="field">
                <span>Display name</span>
                <input
                  name="name"
                  defaultValue={session.user.name}
                  required
                  maxLength={80}
                />
              </label>
              <button className="button button-outline">Update name</button>
            </form>
            <button
              className="button button-outline"
              onClick={async () => {
                try {
                  await post("/api/auth/sign-out");
                  location.reload();
                } catch {
                  setStatus("Could not sign out.");
                }
              }}
            >
              Sign out
            </button>
            <form
              className="delete-account-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const password = new FormData(e.currentTarget).get("password");
                if (
                  !confirm(
                    "Delete your Ranga account and every shared project you own? This cannot be undone. Browser-only projects are separate.",
                  )
                )
                  return;
                try {
                  await post("/api/auth/delete-user", { password });
                  router.push("/projects");
                } catch (e) {
                  setStatus(
                    e instanceof Error
                      ? e.message
                      : "Could not delete account.",
                  );
                }
              }}
            >
              <label className="field">
                <span>Current password to delete account</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button className="button button-outline danger">
                Delete account and owned shared projects
              </button>
            </form>
            <Link className="text-link" href="/recover">
              Password recovery
            </Link>
          </>
        ) : (
          <>
            <p>
              No Ranga account is signed in. You can still work on browser-only
              projects.
            </p>
            <Link className="button button-outline" href="/login">
              Sign in
            </Link>{" "}
            <Link className="button button-accent" href="/register">
              Create account
            </Link>
          </>
        )}
        <p role="status">{status}</p>
      </div>
    </section>
  );
}
