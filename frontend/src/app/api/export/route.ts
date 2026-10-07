import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Relais du téléchargement CSV/JSON des enregistrements cités dans une réponse. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = searchParams.get('ids') ?? '';
  const format = searchParams.get('format') ?? 'json';
  try {
    const upstream = await fetch(
      `${API_URL}/export?ids=${encodeURIComponent(ids)}&format=${encodeURIComponent(format)}`,
      { signal: AbortSignal.timeout(15_000), cache: 'no-store' },
    );
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'content-disposition': upstream.headers.get('content-disposition') ?? 'attachment',
      },
    });
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
