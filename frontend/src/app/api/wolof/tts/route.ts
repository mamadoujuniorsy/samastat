const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Relais de la synthèse vocale wolof : texte → WAV. */
export async function POST(req: Request) {
  let body: string;
  try {
    body = JSON.stringify(await req.json());
  } catch {
    return Response.json({ message: 'Corps de requête invalide.' }, { status: 400 });
  }
  try {
    const upstream = await fetch(`${API_URL}/wolof/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      return new Response(await upstream.text(), { status: upstream.status, headers: { 'content-type': 'application/json' } });
    }
    return new Response(await upstream.arrayBuffer(), { status: 200, headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=3600' } });
  } catch {
    return Response.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  }
}
