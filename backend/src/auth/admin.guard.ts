import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionClaims } from './token.js';

/** Réserve la gestion des comptes aux agents ayant le rôle administrateur. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { staff?: SessionClaims }>();
    if (request.staff?.role !== 'admin') throw new ForbiddenException('Accès réservé aux administrateurs.');
    return true;
  }
}
