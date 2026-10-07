import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Relais serveur vers l'API SamaStat : évite d'exposer l'URL interne et les soucis CORS. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Corps de requête invalide.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_URL}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { message: "L'API SamaStat est injoignable. Vérifiez que le backend est démarré." },
      { status: 502 },
    );
  }
}
