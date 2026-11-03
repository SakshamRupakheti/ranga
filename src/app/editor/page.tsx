"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
  loading: () => <div className="message-page">Opening your workspace…</div>,
});
function EditorRoute() {
  const query = useSearchParams();
  return <Editor key={query.get("shared") ?? "local"} />;
}
export default function EditorPage() {
  return (
    <Suspense
      fallback={<div className="message-page">Preparing your canvas…</div>}
    >
      <EditorRoute />
    </Suspense>
  );
}
