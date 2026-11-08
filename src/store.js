import {validate} from '../shared/validate.js';

// Journals live in PostgreSQL. Unsaved edits exist only in this open page's memory.
export function createJournalStore({userId, request = fetch, events = window, onUnauthorized = () => {}} = {}) {
  if (!userId) throw Error('User id is required');
  let snapshot = {journal: {}, status: 'Подключение…', ready: false, dirty: false, error: null};
  let revision = 0, loaded = false, conflict = false, disposed = false, connecting = false;
  let epoch = 0, timer, sending = null;
  const listeners = new Set();
  const emit = patch => {
    if (disposed) return;
    snapshot = {...snapshot, ...patch};
    listeners.forEach(fn => fn());
  };
  async function apiRequest(init, message) {
    try {return await request('/api/journal', init);} catch {throw Error(message);}
  }
  const schedule = delay => {clearTimeout(timer); timer = setTimeout(push, delay);};
  async function push() {
    if (sending) return sending;
    if (disposed || !loaded || conflict || !snapshot.dirty) return !snapshot.dirty;
    const start = epoch;
    let failed = false;
    emit({status: 'Сохранение в базе…', error: null});
    sending = (async () => {
      try {
        const response = await apiRequest({method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({userId, revision, journal:snapshot.journal})}, 'Изменения не сохранены. Проверь соединение и не закрывай страницу.');
        if (disposed) return false;
        if (response.status === 401) {onUnauthorized(); throw Error('Войди в аккаунт повторно.');}
        if (response.status === 409) {
          conflict = true;
          throw Error('Журнал изменился на другом устройстве. Экспортируй текущие изменения перед обновлением страницы.');
        }
        if (!response.ok) throw Error('Изменения не сохранены. Проверь соединение и не закрывай страницу.');
        const result = await response.json();
        if (disposed) return false;
        revision = result.revision;
        const dirty = epoch !== start;
        emit({dirty, status: dirty ? 'Сохранение в базе…' : 'Сохранено в базе', error: null});
        return !dirty;
      } catch (error) {failed = true; emit({status:error.message, error:error.message}); return false;}
    })();
    const result = await sending;
    sending = null;
    if (snapshot.dirty && !conflict && !disposed) schedule(failed ? 10000 : 300);
    return result;
  }
  async function connect() {
    if (disposed || connecting) return;
    if (loaded && (snapshot.dirty || sending || conflict)) {void push(); return;}
    connecting = true;
    const start = epoch;
    try {
      const response = await apiRequest({cache:'no-store'}, 'Не удалось загрузить журнал из базы. Проверь соединение и повтори.');
      if (disposed) return;
      if (response.status === 401) {onUnauthorized(); throw Error('Войди в аккаунт повторно.');}
      if (!response.ok) throw Error('Не удалось загрузить журнал из базы. Проверь соединение и повтори.');
      const remote = await response.json();
      if (disposed) return;
      if (remote.userId !== userId) {onUnauthorized(); throw Error('Аккаунт изменился. Войди повторно.');}
      validate({version:1,journal:remote.journal});
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw Error('Некорректный ответ базы.');
      if (!snapshot.dirty && start === epoch) {
        revision = remote.revision;
        loaded = true;
        emit({journal:remote.journal, ready:true, status:'Сохранено в базе', error:null});
      }
    } catch (error) {
      emit({status:error.message, error:error.message});
      if (!disposed && !loaded) {clearTimeout(timer); timer = setTimeout(connect, 10000);}
    } finally {connecting = false;}
  }
  function update(change) {
    if (!loaded) throw Error('Сначала дождись загрузки журнала.');
    const journal = structuredClone(snapshot.journal);
    journal.trainingV2 ??= {sessions:{}};
    change(journal);
    validate({version:1,journal});
    epoch++;
    emit({journal, dirty:true, status:'Сохранение в базе…', error:null});
    schedule(300);
  }
  async function flush() {
    clearTimeout(timer);
    if (sending) await sending;
    return snapshot.dirty ? push() : true;
  }
  function start() {
    events.addEventListener('online',connect);
    events.addEventListener('focus',connect);
    const beforeClose = event => {if (snapshot.dirty) {event.preventDefault(); event.returnValue = '';}};
    events.addEventListener('beforeunload',beforeClose);
    void connect();
    return () => {
      disposed = true; clearTimeout(timer);
      events.removeEventListener('online',connect);
      events.removeEventListener('focus',connect);
      events.removeEventListener('beforeunload',beforeClose);
    };
  }
  return {subscribe(fn) {listeners.add(fn); return () => listeners.delete(fn);}, getSnapshot:() => snapshot, update, start, retry:connect, flush};
}
