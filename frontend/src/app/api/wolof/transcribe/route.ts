import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const upstream = await fetch(`${API_URL}/wolof/transcribe`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(50_000),
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: "La transcription est indisponible. Vous pouvez saisir votre question." }, { status: 502 });
  }
}
