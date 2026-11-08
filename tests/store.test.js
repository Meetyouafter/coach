import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createJournalStore} from '../src/store.js';
import {parseTime, lastRows} from '../src/journal.js';
import {workout} from '../shared/program.js';

const settle=async()=>{for(let i=0;i<25;i++) await Promise.resolve();};
const remote=(revision=0,journal={},userId='test-user')=>Response.json({userId,revision,journal});
function setup(t,request,onUnauthorized) {
  t.mock.timers.enable({apis:['setTimeout']});
  const events=new EventTarget();
  const store=createJournalStore({userId:'test-user',events,request,onUnauthorized});
  const stop=store.start();t.after(stop);
  return {store,events,stop};
}
const addSession=j=>{j.trainingV2.sessions['1-0']={date:'2026-11-08T12:00:00Z',status:'Начата',sets:{}};};
test('edits during an in-flight database save use the next revision and remain dirty until saved',async t=>{
  const writes=[];let complete;
  const {store}=setup(t,async(_,init)=>{
    if(!init?.method)return remote();
    writes.push(JSON.parse(init.body));
    if(writes.length===1)return new Promise(resolve=>{complete=resolve;});
    return Response.json({revision:2});
  });
  await settle();store.update(addSession);t.mock.timers.tick(300);await settle();
  store.update(j=>{j.trainingV2.sessions['1-0'].status='Выполнена';});
  assert.equal(store.getSnapshot().dirty,true);
  complete(Response.json({revision:1}));await settle();t.mock.timers.tick(300);await settle();
  assert.equal(writes.length,2);assert.equal(writes[1].revision,1);
  assert.equal(writes[1].userId,'test-user');
  assert.equal(writes[1].journal.trainingV2.sessions['1-0'].status,'Выполнена');
  assert.equal(store.getSnapshot().dirty,false);
  assert.equal(store.getSnapshot().status,'Сохранено в базе');
});
test('conflicts retain unsaved edits in memory and stop automatic overwrites',async t=>{
  let writes=0;
  const {store,events}=setup(t,async(_,init)=>{
    if(!init?.method)return remote(1);
    writes++;return new Response(null,{status:409});
  });
  await settle();store.update(addSession);t.mock.timers.tick(300);await settle();
  t.mock.timers.tick(30000);events.dispatchEvent(new Event('focus'));await settle();
  assert.equal(writes,1);assert.equal(store.getSnapshot().dirty,true);
  assert.match(store.getSnapshot().error,/другом устройстве/);
  assert.equal(await store.flush(),false);
});
test('offline startup cannot edit an empty substitute and reconnects to the database',async t=>{
  let online=false;
  const journal={trainingV2:{sessions:{}}};addSession(journal);
  const {store,events}=setup(t,async()=>{if(!online)throw Error('offline');return remote(3,journal);});
  await settle();assert.equal(store.getSnapshot().ready,false);
  assert.throws(()=>store.update(addSession),/загрузки/);
  online=true;events.dispatchEvent(new Event('online'));await settle();
  assert.equal(store.getSnapshot().ready,true);assert.deepEqual(store.getSnapshot().journal,journal);
});
test('failed writes are reported as unsaved and retry when the network returns',async t=>{
  let writes=0;
  const {store}=setup(t,async(_,init)=>{
    if(!init?.method)return remote();
    if(++writes===1)throw Error('offline');
    return Response.json({revision:1});
  });
  await settle();store.update(addSession);t.mock.timers.tick(300);await settle();
  assert.equal(store.getSnapshot().dirty,true);assert.match(store.getSnapshot().error,/не сохранены/);
  t.mock.timers.tick(10000);await settle();
  assert.equal(writes,2);assert.equal(store.getSnapshot().dirty,false);
});
test('flush saves immediately before signing out and user changes are rejected',async t=>{
  let writes=0;
  const {store}=setup(t,async(_,init)=>{
    if(!init?.method)return remote();
    writes++;return Response.json({revision:1});
  });
  await settle();store.update(addSession);assert.equal(await store.flush(),true);
  assert.equal(writes,1);assert.equal(store.getSnapshot().dirty,false);
});
test('a different server user never replaces the current journal',async t=>{
  let unauthorized=0;
  const {store}=setup(t,async()=>remote(5,{},'another-user'),()=>unauthorized++);
  await settle();assert.equal(unauthorized,1);assert.equal(store.getSnapshot().ready,false);
});
test('reopening the page loads only database data, not unsaved edits from a prior store',async t=>{
  const first=setup(t,async()=>remote());await settle();
  first.store.update(addSession);first.stop();
  const second=createJournalStore({userId:'test-user',events:new EventTarget(),request:async()=>remote()});
  const stop=second.start();t.after(stop);await settle();
  assert.deepEqual(second.getSnapshot().journal,{});
});
test('all 48 workouts and legacy import history remain usable',()=>{
  for(let week=1;week<=12;week++)for(let day=0;day<4;day++){
    const list=workout(week,day);
    assert.equal(list.filter(e=>e.id==='run').length,1);
    assert.equal(new Set(list.map(e=>e.id)).size,list.length);
  }
  assert.equal(parseTime('50:30'),3030);assert.ok(Number.isNaN(parseTime('2:70')));
  const rows=lastRows({'1':{'0':{'0':{a:'10',b:'8',c:'7'}}}},'bench','');
  assert.equal(rows.length,2);assert.equal(rows[0].kg,'10');
});
