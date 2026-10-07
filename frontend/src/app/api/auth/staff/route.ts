import { NextResponse } from 'next/server';
import { API_URL, staffToken } from '@/lib/staff-session';

/** Relais serveur : le jeton du personnel reste inaccessible au navigateur. */
export async function GET() {
  const token = await staffToken();
  if (!token) return NextResponse.json({ message: 'Connexion requise.' }, { status: 401 });
  try {
    const upstream = await fetch(`${API_URL}/auth/staff`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    return NextResponse.json(await upstream.json().catch(() => null), { status: upstream.status });
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = await staffToken();
  if (!token) return NextResponse.json({ message: 'Connexion requise.' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Corps de requête invalide.' }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/auth/staff`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    return NextResponse.json(await upstream.json().catch(() => null), { status: upstream.status });
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
