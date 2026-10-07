const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const dynamic = 'force-dynamic';

/** Relais du flux SSE : les étapes du serveur arrivent au navigateur au fil de l'eau. */
export async function POST(req: Request) {
  let body: string;
  try {
    body = JSON.stringify(await req.json());
  } catch {
    return Response.json({ message: 'Corps de requête invalide.' }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/ask/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body,
      signal: req.signal,
      // @ts-expect-error option Node/undici : flux de réponse non bufferisé
      duplex: 'half',
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  } catch {
    return Response.json(
      { message: "L'API SamaStat est injoignable. Vérifiez que le backend est démarré." },
      { status: 502 },
    );
  }
}
