import { NextResponse } from 'next/server';
import { API_URL, staffToken } from '@/lib/staff-session';

/** Export CSV des questions, réservé au personnel ANSD connecté. */
export async function GET(req: Request) {
  const token = await staffToken();
  if (!token) return NextResponse.json({ message: 'Connexion requise.' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ['days', 'status']) {
    const v = searchParams.get(k);
    if (v) qs.set(k, v);
  }
  try {
    const upstream = await fetch(`${API_URL}/stats/questions.csv?${qs.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8',
        'content-disposition': upstream.headers.get('content-disposition') ?? 'attachment',
      },
    });
  } catch {
    return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
