import { NextResponse } from 'next/server';
import { staffFetch } from '@/lib/staff-session';

export async function GET() {
  const me = await staffFetch<{ name: string; role: string; email: string }>('/auth/me');
  if (me === 'unauthorized' || me === null) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({ name: me.name, role: me.role, email: me.email });
}
