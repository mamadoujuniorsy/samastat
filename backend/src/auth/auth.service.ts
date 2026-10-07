import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken, verifyToken, type SessionClaims } from './token.js';

const SESSION_HOURS = 12;

export interface StaffUser {
  id: number;
  email: string;
  display_name: string;
  role: string;
}

/** Authentification du personnel ANSD : e-mail + mot de passe, jeton de session signé de 12 h. */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    const secret = config.get<string>('SAMASTAT_AUTH_SECRET')?.trim();
    if (!secret) {
      this.logger.warn('SAMASTAT_AUTH_SECRET absent : un secret éphémère est généré, les sessions ne survivront pas au redémarrage.');
    }
    this.secret = secret || `ephemeral-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  /** Crée le premier administrateur à la première exécution, sans réinitialiser son mot de passe ensuite. */
  async onModuleInit(): Promise<void> {
    const email = this.configValue('SAMASTAT_BOOTSTRAP_ADMIN_EMAIL');
    const name = this.configValue('SAMASTAT_BOOTSTRAP_ADMIN_NAME');
    const password = this.config.get<string>('SAMASTAT_BOOTSTRAP_ADMIN_PASSWORD') ?? '';
    if (!email && !name && !password) return;
    if (!email || !name || !password) {
      throw new Error('Configurez SAMASTAT_BOOTSTRAP_ADMIN_EMAIL, _NAME et _PASSWORD ensemble.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
      throw new Error('Le compte admin initial requiert un e-mail valide et un mot de passe de 10 caractères minimum.');
    }

    const existing = await this.db.query('SELECT id FROM staff_users WHERE lower(email) = lower($1)', [email]);
    if (existing.rowCount) {
      this.logger.log(`Compte admin initial déjà présent : ${email}`);
      return;
    }
    await this.db.query(
      `INSERT INTO staff_users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase(), name, await hashPassword(password)],
    );
    this.logger.log(`Compte admin initial créé : ${email.toLowerCase()}`);
  }

  async listStaff(): Promise<Omit<StaffUser, 'id'>[]> {
    const result = await this.db.query<Omit<StaffUser, 'id'>>(
      'SELECT email, display_name, role FROM staff_users ORDER BY display_name, email',
    );
    return result.rows;
  }

  async createStaff(email: string, displayName: string, password: string, role: 'admin' | 'analyste'): Promise<Omit<StaffUser, 'id'>> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await this.db.query<Omit<StaffUser, 'id'>>(
      `INSERT INTO staff_users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING email, display_name, role`,
      [normalizedEmail, displayName.trim(), await hashPassword(password), role],
    );
    return result.rows[0];
  }

  private configValue(key: string): string {
    return this.config.get<string>(key)?.trim() ?? '';
  }

  async login(email: string, password: string): Promise<{ token: string; user: StaffUser } | null> {
    const res = await this.db.query<StaffUser & { password_hash: string }>(
      'SELECT id, email, display_name, role, password_hash FROM staff_users WHERE lower(email) = lower($1)',
      [email.trim()],
    );
    const row = res.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) return null;
    await this.db.query('UPDATE staff_users SET last_login_at = now() WHERE id = $1', [row.id]);
    const claims: SessionClaims = {
      sub: row.id,
      email: row.email,
      name: row.display_name,
      role: row.role,
      exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600,
    };
    return { token: signToken(claims, this.secret), user: { id: row.id, email: row.email, display_name: row.display_name, role: row.role } };
  }

  verify(token: string): SessionClaims | null {
    return verifyToken(token, this.secret);
  }
}
