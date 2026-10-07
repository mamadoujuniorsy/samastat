import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { staffFetch } from '@/lib/staff-session';
import { StaffManager, type StaffAccount } from './staff-manager';

export const dynamic = 'force-dynamic';

export default async function PersonnelPage() {
  const me = await staffFetch<{ role: string }>('/auth/me');
  if (!me || me === 'unauthorized') redirect('/connexion');
  if (me.role !== 'admin') redirect('/usage');
  const accounts = await staffFetch<StaffAccount[]>('/auth/staff');

  return (
    <AppShell current="/personnel">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="rule text-[11px] font-medium tracking-wide text-text-muted">Espace ANSD</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Gestion du personnel</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
          Créez les accès aux outils internes. Les mots de passe sont hachés avant stockage et les routes de gestion sont réservées aux administrateurs.
        </p>
        {accounts && accounts !== 'unauthorized' ? (
          <StaffManager initialStaff={accounts} />
        ) : (
          <p role="alert" className="mt-8 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            Impossible de charger les comptes du personnel. Vérifiez la connexion à l&apos;API.
          </p>
        )}
      </main>
    </AppShell>
  );
}
