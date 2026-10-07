import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AskResponse } from './assistant.types.js';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // sans l, o, 0, 1 : lisible à l'oral et au clavier

function shortId(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Réponses partageables : lien permanent vers une réponse sourcée (journalistes, réseaux, cours). */
@Injectable()
export class AnswersService {
  private readonly logger = new Logger(AnswersService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Enregistre la réponse et renvoie son identifiant court ; null si l'enregistrement échoue. */
  async save(response: AskResponse): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = shortId();
      try {
        const res = await this.db.query(
          'INSERT INTO answers (id, response) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
          [id, JSON.stringify(response)],
        );
        if (res.rowCount) return id;
      } catch (err) {
        this.logger.warn(`Réponse non enregistrée : ${(err as Error).message}`);
        return null;
      }
    }
    return null;
  }

  async get(id: string): Promise<{ response: AskResponse; createdAt: string } | null> {
    if (!/^[a-z0-9]{6,12}$/.test(id)) return null;
    const res = await this.db.query<{ response: AskResponse; created_at: string }>(
      'SELECT response, created_at FROM answers WHERE id = $1',
      [id],
    );
    const row = res.rows[0];
    return row ? { response: row.response, createdAt: new Date(row.created_at).toISOString() } : null;
  }
}
