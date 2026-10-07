import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET() {
  try {
    const upstream = await fetch(`${API_URL}/wolof/status`, { signal: AbortSignal.timeout(5_000), cache: 'no-store' });
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ translation: { enabled: false }, tts: { enabled: false } }, { status: 502 });
  }
}
