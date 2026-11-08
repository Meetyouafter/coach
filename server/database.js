import {neon} from '@neondatabase/serverless';
import {databaseConfigError} from './config.js';
import {HttpError} from './http.js';

export function databaseQuery(env = process.env) {
  const error = databaseConfigError(env);
  if (error) throw new HttpError(503, error);
  const sql = neon(env.DATABASE_URL);
  return (text, params = []) => sql.query(text, params);
}

export function createJournalRepository(query) {
  return {
    async read(user) {
      const rows = await query('SELECT revision, journal FROM workout_journals WHERE user_id = $1', [user]);
      return rows[0] ?? {revision: 0, journal: {}};
    },
    async write(user, revision, journal) {
      const rows = revision === 0
        ? await query('INSERT INTO workout_journals (user_id, revision, journal) VALUES ($1, 1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING RETURNING revision', [user, JSON.stringify(journal)])
        : await query('UPDATE workout_journals SET journal = $1::jsonb, revision = revision + 1 WHERE user_id = $2 AND revision = $3 RETURNING revision', [JSON.stringify(journal), user, revision]);
      return rows[0] ?? null;
    },
  };
}
