import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createJournalRepository} from '../server/database.js';
import {createJournalHandler} from '../api/journal.js';
import {createSessionHandler} from '../api/session.js';
import {authenticated, issueSession} from '../server/auth.js';

const env = {APP_PASSWORD: 'a-test-password-with-32-characters'};
const schema = await readFile(new URL('../db/0001_journal.sql', import.meta.url), 'utf8');
async function setup(t) {
  const db = new PGlite();
  await db.exec(schema);
  t.after(() => db.close());
  const repository = createJournalRepository(async (sql, params) => (await db.query(sql, params)).rows);
  const handler = createJournalHandler({env, repository});
  return {db, repository, request: options => call(handler, options)};
}
async function call(handler, {method = 'GET', payload, raw, cookie = 'coach_session=' + issueSession(env), origin = 'https://app.test', parsed = false, headers = {}} = {}) {
  const text = raw ?? (payload === undefined ? '' : JSON.stringify(payload));
  const req = Readable.from(text ? [Buffer.from(text)] : []);
  req.method = method;
  req.headers = {host: 'app.test', 'x-forwarded-proto': 'https', origin, cookie, ...headers};
  if (parsed && payload !== undefined) req.body = payload;
  const res = {statusCode: 200, headers: {}, setHeader(k, v) {this.headers[k.toLowerCase()] = v;}, end(value) {this.body = value ? JSON.parse(value) : null;}};
  await handler(req, res);
  return {status: res.statusCode, headers: res.headers, body: res.body};
}
const journal = {trainingV2: {sessions: {'1-0': {status: 'Начата', date: '2026-11-08T12:00:00Z', sets: {bench: {'0': {kg: 10, value: 8, unit: 'reps', effort: 6, date: '2026-11-08T12:00:00Z'}}}}}}};
test('PostgreSQL stores JSONB and rejects stale revisions atomically', async t => {
  const {request, repository} = await setup(t);
  assert.deepEqual((await request()).body, {revision: 0, journal: {}});
  assert.equal((await request({method: 'PUT', payload: {revision: 0, journal}})).status, 200);
  assert.deepEqual((await request()).body, {revision: 1, journal});
  assert.deepEqual(await repository.read('other-user'), {revision: 0, journal: {}});
  const results = await Promise.all([
    request({method: 'PUT', parsed: true, payload: {revision: 1, journal}}),
    request({method: 'PUT', payload: {revision: 1, journal: {}}}),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await request()).body.revision, 2);
  assert.equal((await request({method: 'PUT', payload: {revision: 0, journal: {}}})).status, 409);
});
test('API validates authentication, origin, JSON and request size', async t => {
  const {request} = await setup(t);
  assert.equal((await request({cookie: ''})).status, 401);
  assert.equal((await request({cookie: '', headers: {'oai-authenticated-user-id': 'owner'}})).status, 401);
  assert.equal((await request({method: 'PUT', origin: 'https://other.test', payload: {revision: 0, journal}})).status, 403);
  assert.equal((await request({method: 'PUT', raw: 'invalid'})).status, 400);
  for (const payload of [null, {revision: -1, journal}, {revision: .5, journal}, {revision: 0, journal: {unknown: {}}}, {revision: 0, journal: {...journal, trainingV2: {sessions: {'13-0': {}}}}}]) {
    assert.equal((await request({method: 'PUT', payload})).status, 400);
  }
  assert.equal((await request({method: 'PUT', payload: {journal: 'я'.repeat(250001)}})).status, 413);
  assert.equal((await request({method: 'PUT', parsed: true, payload: {journal: 'a'.repeat(500001)}})).status, 413);
  const unsupported = await request({method: 'DELETE'});
  assert.equal(unsupported.status, 405);
  assert.equal(unsupported.headers.allow, 'GET, PUT');
});
test('schema can be applied repeatedly and legacy records roundtrip', async t => {
  const {db, request} = await setup(t);
  await db.exec(schema);
  const legacy = {'1': {'0': {'0': {done: true, a: '10', b: '8', c: '8'}, note: 'Тренировка'}}};
  assert.equal((await request({method: 'PUT', payload: {revision: 0, journal: legacy}})).status, 200);
  assert.deepEqual((await request()).body.journal, legacy);
});
test('login signs a private cookie; invalid, expired and old-password cookies fail', async () => {
  const handler = createSessionHandler(env);
  assert.equal((await call(handler, {cookie: ''})).body.authenticated, false);
  assert.equal((await call(handler, {method: 'POST', payload: {password: 'wrong'}})).status, 401);
  assert.equal((await call(handler, {method: 'POST', origin: 'https://other.test', payload: {password: env.APP_PASSWORD}})).status, 403);
  const login = await call(handler, {method: 'POST', payload: {password: env.APP_PASSWORD}, parsed: true});
  assert.equal(login.status, 200);
  const cookie = login.headers['set-cookie'];
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.equal((await call(handler, {cookie})).body.authenticated, true);
  assert.equal((await call(handler, {cookie: cookie.replace(/coach_session=./, 'coach_session=X')})).body.authenticated, false);
  assert.equal(authenticated({headers: {cookie: 'coach_session=' + issueSession(env, 0)}}, env), false);
  assert.equal(authenticated({headers: {cookie}}, {APP_PASSWORD: 'another-password-with-32-characters'}), false);
  const logout = await call(handler, {method: 'DELETE', cookie});
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  assert.equal(logout.body.authenticated, false);
});
test('configuration and database failures return useful errors without leaking secrets', async () => {
  assert.equal((await call(createSessionHandler({}), {})).status, 503);
  const handler = createJournalHandler({env, repository: {read() {throw Error('postgres://secret-connection');}}});
  const response = await call(handler);
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response.body).includes('secret-connection'));
});
