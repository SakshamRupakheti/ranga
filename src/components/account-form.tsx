"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { post } from "@/lib/api";
export function AccountForm({
  mode,
}: {
  mode: "login" | "register" | "recover";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="account-page">
      <Link href="/projects" className="wordmark">
        Ranga.
      </Link>
      <div className="account-card">
        <p className="eyebrow">YOUR CREATIVE WORKSPACE</p>
        <h1>
          {mode === "register"
            ? "Make room for your team."
            : mode === "recover"
              ? "Find your way back."
              : "Welcome back."}
        </h1>
        <p>
          {mode === "register"
            ? "Create a Ranga account on this local server."
            : mode === "recover"
              ? "Password reset delivery uses a private local development outbox."
              : "Sign in to your shared projects."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              if (mode === "recover") {
                const token = new URLSearchParams(location.search).get("token");
                if (token) {
                  await post("/api/auth/reset-password", {
                    token,
                    newPassword: form.get("password"),
                  });
                  setMessage("Password changed. You can sign in now.");
                } else {
                  await post("/api/auth/request-password-reset", {
                    email: form.get("email"),
                    redirectTo: "/recover",
                  });
                  setMessage(
                    "If this account exists, a reset link is available in the server’s private development outbox. Email delivery is not configured.",
                  );
                }
              } else {
                await post(
                  `/api/auth/${mode === "register" ? "sign-up" : "sign-in"}/email`,
                  {
                    email: form.get("email"),
                    password: form.get("password"),
                    ...(mode === "register" ? { name: form.get("name") } : {}),
                  },
                );
                const next = new URL(
                  new URLSearchParams(location.search).get("next") ||
                    "/projects",
                  location.origin,
                );
                router.push(
                  next.origin === location.origin
                    ? next.pathname + next.search + next.hash
                    : "/projects",
                );
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not continue.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "register" && (
            <label className="field">
              <span>Your name</span>
              <input required name="name" maxLength={80} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              required={mode !== "recover"}
              name="email"
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>
              {mode === "recover"
                ? "New password (only with a reset link)"
                : "Password"}
            </span>
            <input
              name="password"
              type="password"
              required={mode !== "recover"}
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {mode === "register" && (
            <p className="quiet-note">
              Use at least 12 characters. This is your Ranga password, never
              your ChatGPT or Pinterest password.
            </p>
          )}
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <button disabled={busy} className="button button-accent full-width">
            {busy
              ? "Please wait…"
              : mode === "register"
                ? "Create account"
                : mode === "recover"
                  ? "Continue"
                  : "Sign in"}
          </button>
        </form>
        <div className="account-links">
          <Link href={mode === "register" ? "/login" : "/register"}>
            {mode === "register"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </Link>
          <Link href="/recover">Password recovery</Link>
          <Link href="/projects">Continue with local projects</Link>
        </div>
        <p className="quiet-note">
          Local development service. No email verification or hosted deployment
          is configured.
        </p>
      </div>
    </main>
  );
}
