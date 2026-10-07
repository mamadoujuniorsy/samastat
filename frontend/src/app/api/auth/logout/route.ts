import { NextResponse } from 'next/server';
import { STAFF_COOKIE } from '@/lib/staff-session';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/', req.url), { status: 303 });
  res.cookies.set({ name: STAFF_COOKIE, value: '', path: '/', maxAge: 0 });
  return res;
}
