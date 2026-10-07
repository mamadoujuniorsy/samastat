import { cookies } from "next/headers";

export const STAFF_COOKIE = "samastat_staff";
export const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Jeton de session du personnel ANSD, lu depuis le cookie httpOnly posé à la connexion. */
export async function staffToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(STAFF_COOKIE)?.value ?? null;
}

/** Appel à l'API au nom du personnel connecté ; null si pas de session ou session refusée. */
export async function staffFetch<T>(path: string): Promise<T | null | "unauthorized"> {
  const token = await staffToken();
  if (!token) return "unauthorized";
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) return "unauthorized";
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
