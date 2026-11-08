import {authenticated, issueSession, passwordMatches, sessionCookie} from '../server/auth.js';
import {apiErrors, body, HttpError, json, sameOrigin} from '../server/http.js';

export function createSessionHandler(env = process.env) {
  return apiErrors(async (req, res) => {
    if (req.method === 'GET') return json(res, 200, {authenticated: authenticated(req, env)});
    if (!['POST', 'DELETE'].includes(req.method)) {res.setHeader('Allow', 'GET, POST, DELETE'); return json(res, 405, {error: 'Метод не поддерживается.'});}
    if (!sameOrigin(req)) throw new HttpError(403, 'Недопустимый источник запроса.');
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', sessionCookie(req, ''));
      return json(res, 200, {authenticated: false});
    }
    const payload = await body(req, 4096);
    if (!passwordMatches(payload?.password, env)) throw new HttpError(401, 'Неверный пароль.');
    res.setHeader('Set-Cookie', sessionCookie(req, issueSession(env)));
    return json(res, 200, {authenticated: true});
  });
}
export default createSessionHandler();
