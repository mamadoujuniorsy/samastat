"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { IconChart, IconClose, IconLock, IconMenu, IconMoon, IconPlus, IconSun, IconUser } from "./icons";

export type Section = "/" | "/catalogue" | "/usage" | "/personnel" | "/methode" | "/indicateur" | "/connexion";
type Theme = "light" | "dark" | "system";
interface Staff { name: string; role: string }

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("samastat.theme");
    return t === "dark" || t === "light" ? t : "system";
  } catch { return "system"; }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    if (t === "system") localStorage.removeItem("samastat.theme");
    else localStorage.setItem("samastat.theme", t);
  } catch { /* stockage indisponible */ }
}

export function AppShell({ current, children }: { current: Section; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((j: Staff | null) => setStaff(j?.name ? j : null)).catch(() => setStaff(null));
  }, []);

  useEffect(() => {
    if (!open && !profileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setProfileOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, profileOpen]);

  const cycleTheme = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next); applyTheme(next);
  };

  return (
    <div className={current === "/" ? "chat-home min-h-dvh" : "min-h-dvh bg-bg text-text"}>
      <header className={`fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-3 sm:px-5 ${current === "/" ? "" : "border-b border-border bg-bg/95 backdrop-blur"}`}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-lg text-current hover:bg-surface-muted"><IconMenu size={20} /></button>
          <Link href="/?new=1" className="rounded-lg px-2 py-2 text-sm font-semibold tracking-tight hover:bg-surface-muted">SamaStat</Link>
        </div>
        {current !== "/" && staff && <span className="text-sm text-text-muted">Espace ANSD</span>}
      </header>

      {open && <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu SamaStat">
        <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55" />
        <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[88vw] flex-col border-r border-border bg-bg-elevated text-text shadow-card">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/?new=1" onClick={() => setOpen(false)} className="text-sm font-semibold">SamaStat</Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted"><IconClose size={18} /></button>
          </div>
          <nav className="px-3 pt-2" aria-label="Navigation principale">
            <Link href="/?new=1" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted"><IconPlus size={18} />Nouvelle conversation</Link>
            {staff && <Link href="/usage" onClick={() => setOpen(false)} aria-current={current === "/usage" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconChart size={18} />Tableau de bord ANSD</Link>}
            {staff?.role === "admin" && <Link href="/personnel" onClick={() => setOpen(false)} aria-current={current === "/personnel" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconUser size={18} />Gestion du personnel</Link>}
            {!staff && <Link href="/connexion" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconLock size={18} />Connexion du personnel</Link>}
          </nav>
          <div className="mt-auto border-t border-border p-3">
            {staff ? <div className="relative">
              <button type="button" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen} className="flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">{staff.name.trim().slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{staff.name}</span><span className="block text-xs text-text-muted">{staff.role === "admin" ? "Administrateur" : "Analyste"}</span></span>
                <span aria-hidden="true" className="text-text-muted">···</span>
              </button>
              {profileOpen && <div className="absolute inset-x-1 bottom-full mb-2 rounded-xl border border-border bg-surface p-1 shadow-card">
                <button type="button" onClick={cycleTheme} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted">{theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}Thème {theme === "system" ? "système" : theme === "light" ? "clair" : "sombre"}</button>
                <form action="/api/auth/logout" method="post"><button type="submit" className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-danger hover:bg-danger-soft">Déconnexion</button></form>
              </div>}
            </div> : <>
              <button type="button" onClick={cycleTheme} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-xs text-text-muted hover:bg-surface-muted">{theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}Thème {theme === "system" ? "système" : theme === "light" ? "clair" : "sombre"}</button>
            </>}
          </div>
        </aside>
      </div>}

      <div className={current === "/" ? "flex h-dvh flex-col overflow-hidden" : "min-h-[calc(100dvh-3.5rem)] pt-14"}>{children}</div>
    </div>
  );
}
