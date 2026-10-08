import { Chat } from "@/components/chat";
import { AppShell } from "@/components/app-shell";
import { Suspense } from "react";

export default function Home() {
  return (
    <AppShell current="/">
      <Suspense fallback={<p role="status" className="p-6 text-sm text-text-muted">Chargement de la conversation…</p>}>
        <Chat />
      </Suspense>
    </AppShell>
  );
}
