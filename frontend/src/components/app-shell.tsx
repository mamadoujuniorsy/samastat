"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconBook, IconChart, IconClose, IconGrid, IconLock, IconMenu, IconMoon, IconPlus, IconSun, IconUser } from "./icons";

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
  updateThemeColor(t);
}

function updateThemeColor(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141517" : "#f6f4ee");
}

export function AppShell({ current, children }: { current: Section; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [staff, setStaff] = useState<Staff | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((j: Staff | null) => setStaff(j?.name ? j : null)).catch(() => setStaff(null));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => updateThemeColor(theme);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [theme]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        profileRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileOpen]);

  const cycleTheme = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next); applyTheme(next);
  };

  return (
    <div className={current === "/" ? "chat-home min-h-dvh" : "min-h-dvh bg-bg text-text"}>
      <a href="#page-content" className="sr-only fixed left-3 top-2 z-50 rounded-lg bg-surface px-4 py-3 text-sm focus:not-sr-only">Aller au contenu</a>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} aria-controls="navigation-dialog" className="flex h-11 w-11 items-center justify-center rounded-lg text-current hover:bg-surface-muted"><IconMenu size={20} /></button>
          <Link href="/?new=1" className="inline-flex min-h-11 items-center rounded-lg px-2 py-2 text-sm font-semibold tracking-tight hover:bg-surface-muted">SamaStat</Link>
        </div>
        {current !== "/" && staff && <span className="text-sm text-text-muted">Espace ANSD</span>}
      </header>

      <dialog id="navigation-dialog" ref={dialogRef} aria-label="Menu SamaStat" onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        onClose={() => { setOpen(false); setProfileOpen(false); }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-text backdrop:bg-black/55">
        <button type="button" aria-label="Fermer le menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0" />
        <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[88vw] flex-col overflow-y-auto overscroll-contain border-r border-border bg-bg-elevated text-text shadow-card">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/?new=1" onClick={() => setOpen(false)} className="text-sm font-semibold">SamaStat</Link>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted"><IconClose size={18} /></button>
          </div>
          <nav className="px-3 pt-2" aria-label="Navigation principale">
            <Link href="/?new=1" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted"><IconPlus size={18} />Nouvelle conversation</Link>
            <Link href="/catalogue" onClick={() => setOpen(false)} aria-current={current === "/catalogue" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted"><IconGrid size={18} />Catalogue des données</Link>
            <Link href="/methode" onClick={() => setOpen(false)} aria-current={current === "/methode" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted"><IconBook size={18} />Méthode et sources</Link>
            {staff && <Link href="/usage" onClick={() => setOpen(false)} aria-current={current === "/usage" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconChart size={18} />Tableau de bord ANSD</Link>}
            {staff?.role === "admin" && <Link href="/personnel" onClick={() => setOpen(false)} aria-current={current === "/personnel" ? "page" : undefined} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconUser size={18} />Gestion du personnel</Link>}
            {!staff && <Link href="/connexion" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted hover:text-text"><IconLock size={18} />Connexion du personnel</Link>}
          </nav>
          <div className="mt-auto border-t border-border p-3">
            {staff ? <div className="relative">
              <button ref={profileRef} type="button" onClick={() => setProfileOpen((v) => !v)} aria-expanded={profileOpen} className="flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">{staff.name.trim().slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{staff.name}</span><span className="block text-xs text-text-muted">{staff.role === "admin" ? "Administrateur" : "Analyste"}</span></span>
                <span aria-hidden="true" className="text-text-muted">···</span>
              </button>
              {profileOpen && <div className="absolute inset-x-1 bottom-full mb-2 rounded-xl border border-border bg-surface p-1 shadow-card">
                <button type="button" onClick={cycleTheme} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted">{theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}Thème {theme === "system" ? "système" : theme === "light" ? "clair" : "sombre"}</button>
                <form action="/api/auth/logout" method="post"><button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-danger hover:bg-danger-soft">Déconnexion</button></form>
              </div>}
            </div> : <>
              <button type="button" onClick={cycleTheme} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-text-muted hover:bg-surface-muted">{theme === "dark" ? <IconMoon size={16} /> : <IconSun size={16} />}Thème {theme === "system" ? "système" : theme === "light" ? "clair" : "sombre"}</button>
            </>}
          </div>
        </aside>
      </dialog>

      <div id="page-content" tabIndex={-1} className="min-h-dvh pt-14 focus:outline-none">{children}</div>
    </div>
  );
}
