import {randomUUID} from 'node:crypto';
import {hashPassword, passwordLookup, verifyPassword} from './auth.js';
import {HttpError} from './http.js';
import {loginError, normalizeLoginValue} from '../shared/account-validation.js';

export function normalizeLogin(value) {
  const error = loginError(value);
  if (error) throw new HttpError(400, error, {login:error});
  return normalizeLoginValue(value);
}
export function createUserRepository(query) {
  return {
    async authenticate(login, password) {
      const [user] = await query('SELECT id, login, password_salt, password_hash FROM app_users WHERE login = $1', [login]);
      // Run a password hash even for unknown logins.
      if (!user) {await hashPassword(password); throw new HttpError(401, 'Неверный логин или пароль.');}
      if (!await verifyPassword(password, user)) throw new HttpError(401, 'Неверный логин или пароль.');
      return {id: user.id, login: user.login};
    },
    async register(login, password, env) {
      const [exists] = await query('SELECT id FROM app_users WHERE login = $1', [login]);
      if (exists) throw new HttpError(409, 'Этот логин уже занят. Попробуй другой.', {login:'Этот логин уже занят. Попробуй другой.'});
      // A password-only account from the previous version can gain a login once.
      const [legacy] = await query('SELECT id, password_salt, password_hash FROM app_users WHERE password_lookup = $1 AND login IS NULL', [passwordLookup(password, env)]);
      if (legacy && await verifyPassword(password, legacy)) {
        const rows = await query('UPDATE app_users SET login = $1 WHERE id = $2 AND login IS NULL RETURNING id, login', [login, legacy.id]);
        if (rows[0]) return rows[0];
      }
      const {salt, hash} = await hashPassword(password);
      const rows = await query('INSERT INTO app_users (id, login, password_lookup, password_salt, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id, login', [randomUUID(), login, randomUUID(), salt, hash]);
      if (!rows[0]) throw new HttpError(409, 'Этот логин уже занят. Попробуй другой.', {login:'Этот логин уже занят. Попробуй другой.'});
      return rows[0];
    },
    async find(id) {
      const rows = await query('SELECT id, login FROM app_users WHERE id = $1', [id]);
      return rows[0] ?? null;
    },
    async claimLegacyJournal(userId) {
      await query("UPDATE workout_journals SET user_id = $1 WHERE user_id = 'owner' AND NOT EXISTS (SELECT 1 FROM workout_journals WHERE user_id = $1)", [userId]);
    },
  };
}
