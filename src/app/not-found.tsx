import Link from "next/link";
export default function NotFound() {
  return (
    <main className="message-page">
      <p className="eyebrow">404</p>
      <h1>This page is off the canvas.</h1>
      <Link href="/projects" className="button button-dark">
        Back to your projects
      </Link>
    </main>
  );
}
