import {validate} from '../shared/validate.js';

const stateKey = 'zal-beg-cloud-v2';
export function createJournalStore({storage, request = fetch, events = window, onUnauthorized = () => {}} = {}) {
  let snapshot = {journal: {}, status: 'Подключение…', ready: false};
  let revision = 0, dirty = false, loaded = false, sending = false, conflict = false;
  let epoch = 0, timer, disposed = false, connecting = false;
  const listeners = new Set();
  const emit = patch => {
    if (disposed) return;
    snapshot = {...snapshot, ...patch};
    listeners.forEach(fn => fn());
  };
  const cache = () => {
    try {storage?.setItem(stateKey, JSON.stringify({journal: snapshot.journal, rev: revision, dirty})); return !!storage;}
    catch {return false;}
  };
  function schedule(delay = 300) {clearTimeout(timer); timer = setTimeout(push, delay);}
  async function push() {
    if (disposed || !loaded || !dirty || sending || conflict) return;
    sending = true;
    const start = epoch;
    let failed = false;
    try {
      const response = await request('/api/journal', {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify({revision, journal: snapshot.journal})});
      if (response.status === 401) {onUnauthorized(); throw Error('Войди в журнал повторно.');}
      if (response.status === 409) {
        conflict = true;
        throw Error('Журнал изменился на другом устройстве. Экспортируй местную копию перед обновлением.');
      }
      if (!response.ok) throw Error('Облако недоступно. Повторю при восстановлении связи.');
      revision = (await response.json()).revision;
      dirty = epoch !== start;
      cache();
      emit({status: dirty ? 'Сохранено на устройстве' : 'Синхронизировано'});
    } catch (error) {failed = true; emit({status: error.message});}
    finally {sending = false; if (dirty && !conflict && !disposed) schedule(failed ? 10000 : 300);}
  }
  async function connect() {
    if (disposed || connecting) return;
    if (loaded && (dirty || sending || conflict)) {void push(); return;}
    connecting = true;
    const start = epoch;
    try {
      const response = await request('/api/journal', {cache: 'no-store'});
      if (response.status === 401) {onUnauthorized(); throw Error('Войди в журнал повторно.');}
      if (!response.ok) throw Error();
      const remote = await response.json();
      validate({version: 1, journal: remote.journal});
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw Error();
      if (dirty && revision !== remote.revision) {
        conflict = true;
        emit({status: 'Есть несинхронизированные записи, а облако изменилось. Экспортируй локальную копию.'});
      } else if (!dirty && start === epoch) {
        revision = remote.revision;
        emit({journal: remote.journal, status: 'Синхронизировано'});
        cache();
      }
      loaded = true;
      if (dirty && !conflict) void push();
    } catch {emit({status: 'Облако недоступно · данные сохраняются на устройстве'}); if (!disposed) {clearTimeout(timer); timer = setTimeout(connect, 10000);}}
    finally {connecting = false; emit({ready: true});}
  }
  function update(change) {
    const journal = structuredClone(snapshot.journal);
    journal.trainingV2 ??= {sessions: {}};
    change(journal);
    validate({version: 1, journal});
    dirty = true; epoch++;
    emit({journal});
    emit({status: cache() ? 'Сохранено на устройстве' : 'Локальное сохранение недоступно'});
    if (loaded) schedule();
  }
  function start() {
    try {
      const cached = JSON.parse(storage?.getItem(stateKey) || 'null');
      if (cached && Number.isSafeInteger(cached.rev) && cached.rev >= 0 && typeof cached.dirty === 'boolean') {
        validate({version: 1, journal: cached.journal});
        revision = cached.rev; dirty = cached.dirty;
        emit({journal: cached.journal});
      }
    } catch { /* A corrupt cache must not prevent loading the database. */ }
    events.addEventListener('online', connect);
    events.addEventListener('focus', connect);
    void connect();
    return () => {disposed = true; clearTimeout(timer); events.removeEventListener('online', connect); events.removeEventListener('focus', connect);};
  }
  return {subscribe(fn) {listeners.add(fn); return () => listeners.delete(fn);}, getSnapshot: () => snapshot, update, start};
}
