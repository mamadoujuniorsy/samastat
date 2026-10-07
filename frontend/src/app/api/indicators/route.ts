import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Catalogue résumé des indicateurs, pour proposer de vraies questions dans l'état vide. */
export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/indicators`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return NextResponse.json({ indicators: [] }, { status: 502 });
  }
}
