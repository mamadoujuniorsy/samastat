import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { SessionClaims } from './token.js';

/** Protège une route : exige un jeton de session valide (en-tête Authorization: Bearer …). */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { staff?: SessionClaims }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const claims = token ? this.auth.verify(token) : null;
    if (!claims) throw new UnauthorizedException('Connexion requise (personnel ANSD).');
    req.staff = claims;
    return true;
  }
}
