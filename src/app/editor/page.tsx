"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
const Editor = dynamic(() => import("@/components/editor"), {
  ssr: false,
  loading: () => <div className="message-page">Opening your workspace…</div>,
});
export default function EditorPage() {
  return (
    <Suspense
      fallback={<div className="message-page">Preparing your canvas…</div>}
    >
      <Editor />
    </Suspense>
  );
}
