import { createHmac, timingSafeEqual } from 'node:crypto';

/** Jeton de session signé (HMAC-SHA256), sans dépendance : charge utile base64url + signature. */
export interface SessionClaims {
  sub: number;
  email: string;
  name: string;
  role: string;
  exp: number; // secondes epoch
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signToken(claims: SessionClaims, secret: string): string {
  const payload = b64url(JSON.stringify(claims));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string, secret: string): SessionClaims | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
