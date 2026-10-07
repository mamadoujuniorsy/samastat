import { Chat } from "@/components/chat";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell current="/">
      <Chat />
    </AppShell>
  );
}
