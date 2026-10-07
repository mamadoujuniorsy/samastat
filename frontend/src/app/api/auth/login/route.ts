import { NextResponse } from 'next/server';
import { API_URL, STAFF_COOKIE } from '@/lib/staff-session';

/** Connexion du personnel ANSD : le jeton de l'API est conservé dans un cookie httpOnly. */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ message: 'Corps de requête invalide.' }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await upstream.json().catch(() => null)) as { token?: string; user?: unknown; message?: string } | null;
    if (!upstream.ok || !data?.token) {
      return NextResponse.json({ message: data?.message ?? 'Identifiants incorrects.' }, { status: upstream.status === 429 ? 429 : 401 });
    }
    const res = NextResponse.json({ user: data.user });
    res.cookies.set({
      name: STAFF_COOKIE,
      value: data.token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
