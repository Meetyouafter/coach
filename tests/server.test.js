import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createApp} from '../worker/server.js';

function setup(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_journal.sql', import.meta.url), 'utf8'));
  t.after(() => db.close());
  const DB = {prepare(sql) {return {bind(...args) {return {first: async () => db.prepare(sql).get(...args), run: async () => ({meta: {changes: db.prepare(sql).run(...args).changes}})};}};}};
  const app = createApp({page: '<div id="root"></div>', assets: {'/assets/app.js': {type: 'text/javascript', body: 'test'}}});
  return (path = '/api/journal', {user = 'alice', method = 'GET', body, origin = 'https://app.test', env = {}} = {}) => {
    const headers = {origin, 'content-type': 'application/json'};
    if (user) headers['oai-authenticated-user-id'] = user;
    return app.fetch(new Request('https://app.test' + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)}), {DB, ...env});
  };
}
const journal = {trainingV2: {sessions: {'1-0': {status: 'Начата', date: '2026-11-08T12:00:00Z', sets: {bench: {'0': {kg: 10, value: 8, unit: 'reps', effort: 6, date: '2026-11-08T12:00:00Z'}}}}}}};
test('journal persists in SQL, isolates users, and rejects stale revisions', async t => {
  const request = setup(t);
  assert.deepEqual(await (await request()).json(), {revision: 0, journal: {}});
  assert.equal((await request('', {method: 'PUT'})).status, 404);
  const put = body => request('/api/journal', {method: 'PUT', body});
  assert.equal((await put({revision: 0, journal})).status, 200);
  assert.deepEqual(await (await request()).json(), {revision: 1, journal});
  assert.deepEqual(await (await request('/api/journal', {user: 'bob'})).json(), {revision: 0, journal: {}});
  assert.equal((await put({revision: 0, journal: {}})).status, 409);
  assert.equal((await put({revision: 1, journal})).status, 200);
  assert.equal((await put({revision: 1, journal: {}})).status, 409);
  assert.equal((await request()).status, 200);
});
test('API validates input, origin, authentication and size', async t => {
  const request = setup(t);
  assert.equal((await request('/api/journal', {user: null})).status, 401);
  assert.equal((await request('/api/journal', {user: null, env: {LOCAL_DEV: 'true'}})).status, 401);
  assert.equal((await request('/api/journal', {method: 'PUT', origin: 'https://other.test', body: {revision: 0, journal}})).status, 403);
  for (const body of [{revision: -1, journal}, {revision: .5, journal}, {revision: 0, journal: {unknown: {}}}, {revision: 0, journal: {...journal, trainingV2: {sessions: {'13-0': {}}}}}]) {
    assert.equal((await request('/api/journal', {method: 'PUT', body})).status, 400);
  }
  assert.equal((await request('/api/journal', {method: 'PUT', body: {journal: 'a'.repeat(500001)}})).status, 413);
  assert.equal((await request('/api/journal', {method: 'DELETE'})).status, 405);
});
test('legacy records survive roundtrip and React assets are served', async t => {
  const request = setup(t);
  const legacy = {'1': {'0': {'0': {done: true, a: '10', b: '8', c: '8'}, note: 'Тренировка'}}};
  assert.equal((await request('/api/journal', {method: 'PUT', body: {revision: 0, journal: legacy}})).status, 200);
  assert.deepEqual((await (await request()).json()).journal, legacy);
  assert.match(await (await request('/')).text(), /id="root"/);
  assert.equal(await (await request('/assets/app.js')).text(), 'test');
});
