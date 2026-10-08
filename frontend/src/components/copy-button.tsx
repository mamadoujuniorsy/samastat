"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/actions";

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);
  return (
    <button
      type="button"
      onClick={async () => setState((await copyText(text)) ? "done" : "failed")}
      className="min-h-11 underline underline-offset-4 decoration-border-strong hover:decoration-text"
    >
      {state === "done" ? done : state === "failed" ? "Copie impossible" : label}
    </button>
  );
}
