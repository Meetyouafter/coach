import {authenticated} from '../server/auth.js';
import {createJournalRepository, databaseQuery} from '../server/database.js';
import {apiErrors, body, HttpError, json, sameOrigin} from '../server/http.js';
import {validate} from '../shared/validate.js';

export function createJournalHandler({env = process.env, repository} = {}) {
  return apiErrors(async (req, res) => {
    if (!authenticated(req, env)) throw new HttpError(401, 'Войди в журнал.');
    if (!['GET', 'PUT'].includes(req.method)) {res.setHeader('Allow', 'GET, PUT'); return json(res, 405, {error: 'Метод не поддерживается.'});}
    if (req.method === 'PUT' && !sameOrigin(req)) throw new HttpError(403, 'Недопустимый источник запроса.');
    const db = repository ?? createJournalRepository(databaseQuery(env));
    if (req.method === 'GET') return json(res, 200, await db.read('owner'));
    const payload = await body(req);
    try {
      validate({version: 1, journal: payload?.journal});
      if (!Number.isSafeInteger(payload.revision) || payload.revision < 0 || payload.revision >= 2147483647) throw Error();
    } catch {throw new HttpError(400, 'Некорректная запись журнала.');}
    const result = await db.write('owner', payload.revision, payload.journal);
    if (!result) throw new HttpError(409, 'Журнал изменился на другом устройстве.');
    return json(res, 200, result);
  });
}
export default createJournalHandler();
