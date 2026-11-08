import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJournalStore} from '../src/store.js';
import {parseTime, lastRows} from '../src/journal.js';
import {workout} from '../shared/program.js';

const settle = async () => {for (let i = 0; i < 15; i++) await Promise.resolve();};
function setup(t, {cache = null, request} = {}) {
  t.mock.timers.enable({apis: ['setTimeout']});
  let saved = cache;
  const events = new EventTarget();
  const store = createJournalStore({storage: {getItem: () => saved, setItem: (_, value) => {saved = value;}}, events, request});
  const stop = store.start(); t.after(stop);
  return {store, events, saved: () => JSON.parse(saved)};
}
const addSession = j => {j.trainingV2.sessions['1-0'] = {date: '2026-11-08T12:00:00Z', status: 'Начата', sets: {}};};
test('edits during an in-flight save get a second revision', async t => {
  const writes = []; let complete;
  const {store, saved} = setup(t, {request: async (_, init) => {
    if (!init?.method) return Response.json({revision: 0, journal: {}});
    writes.push(JSON.parse(init.body));
    if (writes.length === 1) return new Promise(resolve => {complete = resolve;});
    return Response.json({revision: 2});
  }});
  await settle(); store.update(addSession); t.mock.timers.tick(300); await settle();
  store.update(j => {j.trainingV2.sessions['1-0'].status = 'Выполнена';});
  complete(Response.json({revision: 1})); await settle(); t.mock.timers.tick(300); await settle();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].revision, 1);
  assert.equal(writes[1].journal.trainingV2.sessions['1-0'].status, 'Выполнена');
  assert.equal(saved().dirty, false);
  assert.equal(saved().rev, 2);
});
test('conflicting cached edits stay local and are never sent', async t => {
  const journal = {trainingV2: {sessions: {}}}; addSession(journal);
  let puts = 0;
  const {store} = setup(t, {cache: JSON.stringify({journal, rev: 1, dirty: true}), request: async (_, init) => {
    if (init?.method) puts++;
    return Response.json({revision: 2, journal: {}});
  }});
  await settle(); t.mock.timers.tick(30000); await settle();
  assert.deepEqual(store.getSnapshot().journal, journal);
  assert.match(store.getSnapshot().status, /облако изменилось/);
  assert.equal(puts, 0);
});
test('offline startup preserves edits and reconnects before saving', async t => {
  let online = false; const writes = [];
  const {store, events} = setup(t, {request: async (_, init) => {
    if (!online) throw Error('offline');
    if (!init?.method) return Response.json({revision: 0, journal: {}});
    writes.push(JSON.parse(init.body)); return Response.json({revision: 1});
  }});
  await settle(); assert.equal(store.getSnapshot().ready, true);
  store.update(addSession); online = true; events.dispatchEvent(new Event('online')); await settle();
  assert.equal(writes.length, 1);
  assert.ok(writes[0].journal.trainingV2.sessions['1-0']);
  assert.equal(store.getSnapshot().status, 'Синхронизировано');
});
test('failed save retries without requiring another edit', async t => {
  let writes = 0;
  const {store} = setup(t, {request: async (_, init) => {
    if (!init?.method) return Response.json({revision: 0, journal: {}});
    if (++writes === 1) throw Error('offline');
    return Response.json({revision: 1});
  }});
  await settle(); store.update(addSession); t.mock.timers.tick(300); await settle();
  t.mock.timers.tick(10000); await settle();
  assert.equal(writes, 2); assert.equal(store.getSnapshot().status, 'Синхронизировано');
});
test('all 48 workouts and legacy history remain usable', () => {
  for (let week = 1; week <= 12; week++) for (let day = 0; day < 4; day++) {
    const list = workout(week, day);
    assert.equal(list.filter(e => e.id === 'run').length, 1);
    assert.equal(new Set(list.map(e => e.id)).size, list.length);
  }
  assert.equal(parseTime('50:30'), 3030);
  assert.ok(Number.isNaN(parseTime('2:70')));
  const rows = lastRows({'1': {'0': {'0': {a: '10', b: '8', c: '7'}}}}, 'bench', '');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kg, '10');
});
