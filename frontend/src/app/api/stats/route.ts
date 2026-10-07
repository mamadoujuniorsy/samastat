import { NextResponse } from 'next/server';
import { staffFetch } from '@/lib/staff-session';

/** Statistiques d'usage, réservées au personnel ANSD connecté. */
export async function GET(req: Request) {
  const days = new URL(req.url).searchParams.get('days') ?? '30';
  const data = await staffFetch<unknown>(`/stats?days=${encodeURIComponent(days)}`);
  if (data === 'unauthorized') return NextResponse.json({ message: 'Connexion requise.' }, { status: 401 });
  if (data === null) return NextResponse.json({ message: "L'API SamaStat est injoignable." }, { status: 502 });
  return NextResponse.json(data);
}
