"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(
          res.status === 429
            ? "Trop de tentatives. Réessayez dans une minute."
            : (body?.message ?? "Identifiants incorrects."),
        );
        return;
      }
      router.push("/usage");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Adresse e-mail professionnelle
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full min-h-11 rounded-md border border-border-strong bg-bg-elevated px-3 text-base"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full min-h-11 rounded-md border border-border-strong bg-bg-elevated px-3 text-base"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-xs text-text-faint">Session de 12 heures. Aucune question posée par le public n&apos;est reliée à un compte.</p>
    </form>
  );
}
