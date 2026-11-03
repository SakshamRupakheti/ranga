"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { post } from "@/lib/api";
export default function Invite() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <main className="account-page">
      <Link className="wordmark" href="/">
        Ranga.
      </Link>
      <section className="account-card">
        <p className="eyebrow">A PLACE AT THE TABLE</p>
        <h1>Join the project.</h1>
        <p>
          Sign in to your own Ranga account before accepting this single-use
          invitation. It expires after seven days.
        </p>
        <button
          className="button button-accent full-width"
          onClick={async () => {
            try {
              const result = await post<{ id: string }>(
                "/api/invitations/accept",
                { token: location.hash.slice(1) },
              );
              history.replaceState(null, "", "/invite");
              router.push(`/editor?shared=${result.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not join.");
            }
          }}
        >
          Accept invitation
        </button>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <p className="quiet-note">
          Keep this invitation tab open while you sign in or register in a
          separate tab.
        </p>
        <div className="account-links">
          <a href="/login" target="_blank" rel="noopener noreferrer">
            Sign in
          </a>
          <a href="/register" target="_blank" rel="noopener noreferrer">
            Create an account
          </a>
        </div>
      </section>
    </main>
  );
}
