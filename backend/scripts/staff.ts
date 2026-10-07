import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../src/auth/password.js';

/**
 * Gestion des comptes du personnel ANSD :
 *   npm run staff:add -- <email> "<nom affiché>" [admin|analyste]      (mot de passe lu dans STAFF_PASSWORD)
 *   npm run staff:list
 *   npm run staff:remove -- <email>
 * Exemple : STAFF_PASSWORD='motdepasse-long' npm run staff:add -- analyste@ansd.sn "Awa Diop" admin
 */
const here = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [path.join(here, '..', '..', '.env'), path.join(here, '..', '.env')]) {
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const [command, email, displayName, role] = process.argv.slice(2);

try {
  if (command === 'add') {
    const password = process.env.STAFF_PASSWORD;
    if (!email || !displayName || !password) {
      console.error('usage : STAFF_PASSWORD=... staff.ts add <email> "<nom>" [admin|analyste]');
      process.exit(1);
    }
    if (password.length < 10) {
      console.error('Le mot de passe doit faire au moins 10 caractères.');
      process.exit(1);
    }
    await pool.query(
      `INSERT INTO staff_users (email, display_name, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [email.trim().toLowerCase(), displayName, await hashPassword(password), role === 'admin' ? 'admin' : 'analyste'],
    );
    console.log(`compte ${email} enregistré (${role === 'admin' ? 'admin' : 'analyste'})`);
  } else if (command === 'list') {
    const res = await pool.query<{ email: string; display_name: string; role: string; last_login_at: string | null }>(
      'SELECT email, display_name, role, last_login_at FROM staff_users ORDER BY email',
    );
    for (const r of res.rows) console.log(`${r.email}\t${r.display_name}\t${r.role}\t${r.last_login_at ?? 'jamais connecté'}`);
    if (!res.rowCount) console.log('aucun compte');
  } else if (command === 'remove') {
    const res = await pool.query('DELETE FROM staff_users WHERE lower(email) = lower($1)', [email ?? '']);
    console.log(res.rowCount ? `compte ${email} supprimé` : 'compte introuvable');
  } else {
    console.error('usage : staff.ts <add|list|remove>');
    process.exit(1);
  }
} finally {
  await pool.end();
}
