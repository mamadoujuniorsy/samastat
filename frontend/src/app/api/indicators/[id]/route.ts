import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Fiche d'un indicateur : enregistrement, séries par période et par territoire, citation. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const upstream = await fetch(`${API_URL}/indicators/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
