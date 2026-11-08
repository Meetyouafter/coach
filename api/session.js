import {authenticatedSession, issueSession, matchesLegacyOwner, sessionCookie} from '../server/auth.js';
import {databaseQuery} from '../server/database.js';
import {createUserRepository, normalizeLogin} from '../server/users.js';
import {apiErrors, body, HttpError, json, sameOrigin} from '../server/http.js';
import {validateAccount} from '../shared/account-validation.js';

export function createSessionHandler({env = process.env, repository} = {}) {
  return apiErrors(async (req, res) => {
    if (req.method === 'GET') {
      const session = authenticatedSession(req, env);
      if (!session) return json(res, 200, {authenticated: false, user: null});
      const users = repository ?? createUserRepository(databaseQuery(env));
      const user = await users.find(session.userId);
      return json(res, 200, {authenticated: !!user, user});
    }
    if (!['POST', 'DELETE'].includes(req.method)) {res.setHeader('Allow', 'GET, POST, DELETE'); return json(res, 405, {error: 'Метод не поддерживается.'});}
    if (!sameOrigin(req)) throw new HttpError(403, 'Недопустимый источник запроса.');
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', sessionCookie(req, ''));
      return json(res, 200, {authenticated: false, user: null});
    }
    const payload = await body(req, 8192);
    if (!['login', 'register'].includes(payload?.action)) throw new HttpError(400, 'Выбери вход или регистрацию.');
    const fieldErrors = validateAccount(payload, payload.action);
    if (Object.keys(fieldErrors).length) throw new HttpError(400, Object.values(fieldErrors)[0], fieldErrors);
    const login = normalizeLogin(payload.login);
    const password = payload.password;
    const users = repository ?? createUserRepository(databaseQuery(env));
    const user = payload.action === 'register' ? await users.register(login, password, env) : await users.authenticate(login, password);
    if (matchesLegacyOwner(password, env)) await users.claimLegacyJournal(user.id);
    res.setHeader('Set-Cookie', sessionCookie(req, issueSession(user.id, env)));
    return json(res, 200, {authenticated: true, user});
  });
}
export default createSessionHandler();
