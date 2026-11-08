import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile, readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createJournalRepository} from '../server/database.js';
import {createJournalHandler} from '../api/journal.js';
import {createSessionHandler} from '../api/session.js';
import {authenticatedUser, issueSession} from '../server/auth.js';
import {createUserRepository} from '../server/users.js';

const env = {APP_PASSWORD: 'a-test-password-with-32-characters'};
const directory = new URL('../db/', import.meta.url);
const schema = (await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql')).sort().map(name => readFile(new URL(name, directory), 'utf8')))).join('\n');
const testUser = '11111111-1111-4111-8111-111111111111';
async function setup(t) {
  const db = new PGlite();
  await db.exec(schema);
  t.after(() => db.close());
  const query = async (sql, params) => (await db.query(sql, params)).rows;
  const repository = createJournalRepository(query);
  const sessionHandler = createSessionHandler({env, repository: createUserRepository(query)});
  const handler = createJournalHandler({env, repository});
  return {db, repository, sessionHandler, handler, request: options => call(handler, options)};
}
async function call(handler, {method = 'GET', payload, raw, cookie = 'coach_session=' + issueSession(testUser, env), origin = 'https://app.test', parsed = false, headers = {}} = {}) {
  if (method === 'PUT' && payload && !Object.hasOwn(payload, 'userId')) payload = {...payload, userId: testUser};
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
  assert.deepEqual((await request()).body, {revision: 0, journal: {}, userId: testUser});
  assert.equal((await request({method: 'PUT', payload: {revision: 0, journal}})).status, 200);
  assert.deepEqual((await request()).body, {revision: 1, journal, userId: testUser});
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
async function register(handler, login, password = 'shared-personal-password-1234') {
  return call(handler,{method:'POST',payload:{action:'register',login,password,confirmPassword:password}});
}
test('registration and login are separate; passwords are salted and sessions contain the user', async t => {
  const {sessionHandler: handler, db} = await setup(t);
  assert.equal((await call(handler,{cookie:''})).body.authenticated,false);
  assert.equal((await register(handler,'alice','')).status,400);
  const signup=await register(handler,'Alice');
  assert.equal(signup.status,200); assert.equal(signup.body.user.login,'alice');
  const cookie=signup.headers['set-cookie'];
  for (const flag of ['HttpOnly','SameSite=Strict','Secure','Path=/']) assert.ok(cookie.includes(flag));
  assert.equal((await call(handler,{cookie})).body.user.id,signup.body.user.id);
  const again=await call(handler,{method:'POST',payload:{action:'login',login:'ALICE',password:'shared-personal-password-1234'}});
  assert.equal(again.status,200); assert.equal(again.body.user.id,signup.body.user.id);
  assert.equal((await register(handler,'alice')).status,409);
  assert.equal((await call(handler,{method:'POST',payload:{action:'login',login:'alice',password:'wrong-personal-password'}})).status,401);
  assert.equal((await call(handler,{method:'POST',payload:{action:'login',login:'unknown',password:'shared-personal-password-1234'}})).status,401);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM app_users')).rows[0].count,1);
  const stored=(await db.query('SELECT * FROM app_users')).rows[0];
  assert.ok(!JSON.stringify(stored).includes('shared-personal-password-1234'));
  assert.equal(stored.password_hash.length,64); assert.equal(stored.password_salt.length,32);
  assert.equal((await call(handler,{cookie:cookie.replace(/coach_session=./,'coach_session=X')})).body.authenticated,false);
  assert.equal(authenticatedUser({headers:{cookie:'coach_session='+issueSession(testUser,env,0)}},env),null);
  assert.equal(authenticatedUser({headers:{cookie}},{AUTH_SECRET:'another-secret-with-32-characters'}),null);
  const logout=await call(handler,{method:'DELETE',cookie});
  assert.match(logout.headers['set-cookie'],/Max-Age=0/);
});
test('different logins with the same password have independent database journals', async t => {
  const {sessionHandler, handler} = await setup(t);
  const a=await register(sessionHandler,'alice'), b=await register(sessionHandler,'bob');
  assert.notEqual(a.body.user.id,b.body.user.id);
  const ac=a.headers['set-cookie'], bc=b.headers['set-cookie'];
  assert.equal((await call(handler,{method:'PUT',cookie:ac,payload:{userId:a.body.user.id,revision:0,journal}})).status,200);
  assert.deepEqual((await call(handler,{cookie:bc})).body.journal,{});
  assert.equal((await call(handler,{method:'PUT',cookie:bc,payload:{userId:a.body.user.id,revision:0,journal}})).status,401);
  assert.deepEqual((await call(handler,{cookie:ac})).body.journal,journal);
});
test('simultaneous registration cannot create duplicate logins', async t => {
  const {sessionHandler,db}=await setup(t);
  const results=await Promise.all([register(sessionHandler,'same-login'),register(sessionHandler,'same-login')]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM app_users')).rows[0].count,1);
});
test('only the old owner password can claim the previous shared journal', async t => {
  const {sessionHandler,repository,handler}=await setup(t);
  await repository.write('owner',0,journal);
  const other=await register(sessionHandler,'other');
  const otherCloud=other.headers['set-cookie'];
  assert.deepEqual((await call(handler,{cookie:otherCloud})).body.journal,{});
  const owner=await register(sessionHandler,'owner-account',env.APP_PASSWORD);
  const ownerCloud=owner.headers['set-cookie'];
  assert.deepEqual((await call(handler,{cookie:ownerCloud})).body.journal,journal);
});
test('configuration and database failures return useful errors without leaking secrets', async () => {
  assert.equal((await call(createSessionHandler({env: {}}), {})).status, 503);
  const handler = createJournalHandler({env, repository: {read() {throw Error('postgres://secret-connection');}}});
  const response = await call(handler);
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response.body).includes('secret-connection'));
});


test('registration requires at least 12 characters and matching confirmation', async t => {
  const {sessionHandler,db}=await setup(t);
  for (const password of ['', 'a', '12345678901']) {
    const result=await register(sessionHandler,'short-password',password);
    assert.equal(result.status,400);
  }
  for (const confirmPassword of [undefined,'different','']) {
    const result=await call(sessionHandler,{method:'POST',payload:{action:'register',login:'short-password',password:'123456789012',confirmPassword}});
    assert.equal(result.status,400);assert.ok(result.body.fieldErrors.confirmPassword);
  }
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM app_users')).rows[0].count,0);
  const signup=await register(sessionHandler,'short-password','123456789012');
  assert.equal(signup.status,200);
  const login=await call(sessionHandler,{method:'POST',payload:{action:'login',login:'short-password',password:'123456789012'}});
  assert.equal(login.status,200);assert.equal(login.body.user.id,signup.body.user.id);
});
