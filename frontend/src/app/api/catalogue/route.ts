import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Catalogue complet, filtrable (domaine, niveau, texte). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ['domain', 'level', 'q']) {
    const v = searchParams.get(k);
    if (v) qs.set(k, v);
  }
  try {
    const upstream = await fetch(`${API_URL}/catalogue?${qs.toString()}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ domains: [], records: [] }, { status: 502 });
  }
}
