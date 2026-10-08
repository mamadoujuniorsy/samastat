import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { staffFetch } from "@/lib/staff-session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/** Espace ANSD : connexion du personnel. Une session valide redirige vers le tableau de bord. */
export default async function ConnexionPage() {
  const me = await staffFetch<{ name: string }>("/auth/me");
  if (me && me !== "unauthorized") redirect("/usage");

  return (
    <AppShell current="/connexion">
      <main className="mx-auto w-full max-w-md px-4 sm:px-6 py-12 flex-1">
        <p className="rule text-xs font-medium tracking-wide text-text-faint">Espace ANSD</p>
        <h1 className="display mt-2 text-[2rem]">Connexion du personnel</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Réservé aux agents de l&apos;Agence Nationale de la Statistique et de la Démographie : tableau de bord des questions
          posées, questions restées sans réponse, exports et administration de l&apos;index. Les comptes sont créés par
          l&apos;administrateur du service.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </main>
    </AppShell>
  );
}
