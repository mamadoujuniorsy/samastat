import { NextResponse } from 'next/server';
import { STAFF_COOKIE } from '@/lib/staff-session';

export async function POST() {
  // Use a relative Location so reverse proxies never expose the internal
  // listening host (for example 0.0.0.0) to the browser.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: '/' },
  });
  res.cookies.set({ name: STAFF_COOKIE, value: '', path: '/', maxAge: 0 });
  return res;
}
