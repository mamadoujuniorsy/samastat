"use client";

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export interface StaffAccount {
  email: string;
  display_name: string;
  role: 'admin' | 'analyste';
}

export function StaffManager({ initialStaff }: { initialStaff: StaffAccount[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch('/api/auth/staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string; email?: string } | null;
      if (!response.ok) {
        setError(result?.message ?? 'Création impossible. Vérifiez les informations saisies.');
        return;
      }
      formElement.reset();
      setNotice(`Le compte ${result?.email ?? ''} a été créé.`);
      router.refresh();
    } catch {
      setError("L'API SamaStat est injoignable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
      <section aria-labelledby="staff-list-title">
        <h2 id="staff-list-title" className="text-lg font-medium">Comptes existants</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
          {initialStaff.map((staff) => (
            <li key={staff.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{staff.display_name}</p>
                <p className="truncate text-sm text-text-muted">{staff.email}</p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                {staff.role === 'admin' ? 'Administrateur' : 'Analyste'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="staff-create-title">
        <h2 id="staff-create-title" className="text-lg font-medium">Créer un compte</h2>
        <form onSubmit={submit} className="mt-3 space-y-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <label htmlFor="staff-name" className="block text-sm font-medium">Nom affiché</label>
            <input id="staff-name" name="displayName" autoComplete="name" required maxLength={120} className="mt-1.5 min-h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-3 text-base" />
          </div>
          <div>
            <label htmlFor="staff-email" className="block text-sm font-medium">Adresse e-mail professionnelle</label>
            <input id="staff-email" name="email" type="email" autoComplete="email" required className="mt-1.5 min-h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-3 text-base" />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-sm font-medium">Mot de passe temporaire</label>
            <input id="staff-password" name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-1.5 min-h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-3 text-base" />
            <p className="mt-1 text-xs text-text-muted">10 caractères minimum. Transmettez-le à la personne de manière confidentielle.</p>
          </div>
          <div>
            <label htmlFor="staff-role" className="block text-sm font-medium">Rôle</label>
            <select id="staff-role" name="role" defaultValue="analyste" className="mt-1.5 min-h-11 w-full rounded-md border border-border-strong bg-bg-elevated px-3 text-base">
              <option value="analyste">Analyste</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          {notice && <p role="status" className="rounded-md bg-accent-soft px-3 py-2 text-sm">{notice}</p>}
          <button type="submit" disabled={pending} className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60">
            {pending ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      </section>
    </div>
  );
}
