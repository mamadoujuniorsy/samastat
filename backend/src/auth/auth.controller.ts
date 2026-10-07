import { BadRequestException, Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { StaffGuard } from './staff.guard.js';
import { AdminGuard } from './admin.guard.js';
import type { SessionClaims } from './token.js';

@ApiTags('Personnel ANSD')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion du personnel ANSD : renvoie un jeton de session (12 h)' })
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] } })
  async login(@Body() body: { email?: unknown; password?: unknown }) {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) throw new BadRequestException('E-mail et mot de passe requis.');
    const session = await this.auth.login(email, password);
    if (!session) throw new UnauthorizedException('Identifiants incorrects.');
    return session;
  }

  @Get('me')
  @UseGuards(StaffGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: 'Profil de la session en cours' })
  me(@Req() req: Request & { staff?: SessionClaims }) {
    const c = req.staff!;
    return { id: c.sub, email: c.email, name: c.name, role: c.role, expiresAt: new Date(c.exp * 1000).toISOString() };
  }

  @Get('staff')
  @UseGuards(StaffGuard, AdminGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: 'Liste les comptes du personnel (administrateur uniquement)' })
  listStaff() {
    return this.auth.listStaff();
  }

  @Post('staff')
  @UseGuards(StaffGuard, AdminGuard)
  @ApiBearerAuth('staff')
  @ApiOperation({ summary: 'Crée un compte du personnel (administrateur uniquement)' })
  async createStaff(@Body() body: { email?: unknown; displayName?: unknown; password?: unknown; role?: unknown }) {
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = body?.role === 'admin' ? 'admin' : body?.role === 'analyste' ? 'analyste' : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Adresse e-mail invalide.');
    if (!displayName || displayName.length > 120) throw new BadRequestException('Le nom est requis (120 caractères maximum).');
    if (password.length < 10) throw new BadRequestException('Le mot de passe doit faire au moins 10 caractères.');
    if (!role) throw new BadRequestException('Rôle invalide.');
    try {
      return await this.auth.createStaff(email, displayName, password, role);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new BadRequestException('Un compte utilise déjà cette adresse e-mail.');
      }
      throw error;
    }
  }
}
