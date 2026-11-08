import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {EX, W, names, phases, ready, workout} from '../shared/program.js';
import {validate} from '../shared/validate.js';
import {dateLabel, describe, lastRows, pace} from './journal.js';
import {createJournalStore} from './store.js';
import {Panel, Technique, Workout} from './components/Workout.jsx';

function nextKey(sessions) {
  const ongoing = Object.keys(sessions).filter(k => sessions[k].status === 'Начата').sort((a, b) => sessions[b].date.localeCompare(sessions[a].date));
  if (ongoing.length) return ongoing[0];
  for (let w = 1; w <= 12; w++) for (let d = 0; d < names.length; d++) if (!sessions[w + '-' + d]) return w + '-' + d;
  return null;
}
function Plan({sessions, open}) {
  const [week, setWeek] = useState(1);
  return <><Panel><h2>План на 12 недель</h2><select aria-label="Неделя плана" value={week} onChange={e => setWeek(Number(e.target.value))}>{W.map((w, i) => <option key={i} value={i + 1}>Неделя {i + 1} · ≈ {w[4]} км</option>)}</select><p className="muted">{phases[week - 1]}</p></Panel>
    {names.map((name, day) => <Panel key={day}><h3>{name}</h3>{workout(week, day, sessions[week + '-' + day]?.deferred).map(e => e.id === 'run' ? <div key={e.id}><p className="run">{e.target}</p><p className="muted">{e.tip}</p></div> : <p key={e.id}>{e.name} · {e.n} × {e.reps} · {e.weight}{e.rir ? ' · RIR ' + e.rir : ''}</p>)}{week === 12 && day === 3 && <p>{ready}</p>}<button onClick={() => open(week + '-' + day)}>{sessions[week + '-' + day] ? 'Открыть занятие' : 'Начать занятие'}</button></Panel>)}
    <Panel><h3>Как прибавлять</h3><p>Сначала добавляй повторы. Когда два занятия подряд все подходы на верхней границе с чистой техникой и минимум 2 RIR, прибавь минимальный вес и вернись к нижней границе. Если две тренировки подряд падают повторы или ноги тяжёлые дольше двух суток, повтори этап или облегчи неделю. Вес гантели указан на одну руку.</p><p>Разминка перед силовой 5–8 мин и 1–3 пробных подхода. Отдых 2–3 мин в основных движениях, 90–120 сек в остальных, 30–60 сек на пресс.</p></Panel>
  </>;
}
function Legacy({journal}) {
  const ids = [['bench','leg','rdl','row','calf','run','side'], ['press','chestrow','lateral','run','bug'], ['lunge','bridge','incline','lat','seated','ham','run','pallof'], ['run','crunch']];
  const weeks = Object.keys(journal).filter(k => /^\d+$/.test(k));
  if (!weeks.length) return null;
  return <Panel><h3>Записи из прежней версии</h3>{weeks.flatMap(week => Object.entries(journal[week]).map(([day, records]) => {
    const actual = Object.entries(records).filter(([i, r]) => i === 'note' ? !!r : r.done || r.a || r.b || r.c);
    if (!actual.length) return null;
    return <details key={week + '-' + day}><summary>Неделя {week} · {names[day]}</summary>{actual.map(([i, r]) => <p key={i}>{i === 'note' ? r : (EX[ids[day][i]]?.[0] ?? 'Бег') + ' · ' + [r.done ? 'выполнено' : '', r.a, r.b, r.c].filter(Boolean).join(' · ')}</p>)}</details>;
  }))}</Panel>;
}
function History({journal, open, update, initialExpanded}) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(initialExpanded);
  const [error, setError] = useState('');
  const file = useRef(null);
  const sessions = journal.trainingV2?.sessions ?? {};
  const rows = filter ? lastRows(journal, filter, '') : [];
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, journal}, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'zal-beg-journal.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function upload(event) {
    const target = event.target, selected = target.files[0];
    if (!selected) return;
    try {
      if (selected.size > 500000) throw Error();
      const incoming = validate(JSON.parse(await selected.text()));
      const add = incoming.trainingV2?.sessions ?? {};
      const replace = Object.keys(add).filter(k => sessions[k]).length;
      const weeks = Object.keys(incoming).filter(k => /^\d+$/.test(k));
      const oldReplace = weeks.filter(k => journal[k]).length;
      if (!confirm(`Будет добавлено занятий: ${Object.keys(add).length - replace}, заменено: ${replace}. Старые недели: ${weeks.length - oldReplace} добавятся, ${oldReplace} заменятся. Продолжить?`)) return;
      update(j => {for (const w of weeks) j[w] = incoming[w]; Object.assign(j.trainingV2.sessions, add);});
      setError('');
    } catch {setError('Не удалось прочитать резервную копию.');}
    finally {target.value = '';}
  }
  return <><Panel><h2>История</h2><select aria-label="Упражнение в истории" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Выбрать упражнение</option>{Object.entries(EX).map(([id, e]) => <option key={id} value={id}>{e[0]}</option>)}</select></Panel>
    {filter && <Panel>{rows.length ? rows.map((r, i) => <p key={i}>{r.date ? dateLabel(r.date) : r.k} · подход {r.i + 1} · {describe(r)}</p>) : <p>Записей пока нет</p>}</Panel>}
    {!Object.keys(sessions).length && <Panel><p>Занятий пока нет. Начни тренировку в разделе «Сегодня» или открой план.</p></Panel>}
    {Object.entries(sessions).sort((a, b) => b[1].date.localeCompare(a[1].date)).map(([key, s]) => {const [week, day] = key.split('-').map(Number); return <Panel key={key}><h3>{names[day]} · неделя {week}</h3><p>{dateLabel(s.date)} · {s.status}</p>{s.run && <p className="run">{s.run.km} км · {s.run.time} · {pace(s.run.km, s.run.sec)} · усилие {s.run.effort}/10{s.run.pulse ? ' · пульс ' + s.run.pulse : ''}</p>}
      {expanded === key && Object.entries(s.sets).flatMap(([id, records]) => Object.entries(records).map(([i, r]) => <p key={id + i}>{EX[id]?.[0] ?? id} · № {Number(i) + 1} · {r.skip ? 'пропущен' : describe(r)}</p>))}
      <button onClick={() => setExpanded(expanded === key ? '' : key)}>{expanded === key ? 'Свернуть' : 'Подходы'}</button><button onClick={() => open(key)}>Открыть занятие</button></Panel>;})}
    <Legacy journal={journal} /><Panel><button onClick={download}>Экспорт JSON</button><button onClick={() => file.current.click()}>Импорт JSON</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={upload} /><p role="alert" className="error">{error}</p></Panel>
  </>;
}
export function App({onUnauthorized, onSignOut}) {
  const [store] = useState(() => {
    let storage;
    try {storage = window.localStorage;} catch { /* Storage can be blocked by the browser. */ }
    return createJournalStore({storage, onUnauthorized});
  });
  const {journal, status, ready: loaded} = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [tab, setTab] = useState('today');
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState('');
  const [technique, setTechnique] = useState(null);
  useEffect(() => store.start(), [store]);
  const sessions = journal.trainingV2?.sessions ?? {};
  const key = nextKey(sessions);
  function open(key) {
    if (!sessions[key]) store.update(j => {j.trainingV2.sessions[key] = {status: 'Начата', date: new Date().toISOString(), sets: {}};});
    setActive(key); setTab('today');
  }
  function finish() {setExpanded(active); setActive(null); setTab('history');}
  return <><main><header><p className="tag">12 недель · набор мышечной массы</p><h1>Зал и бег</h1><p className="muted" role="status">{status}</p><button onClick={onSignOut}>Выйти</button></header><div id="screen">
    {!loaded ? <p className="boot">Загрузка журнала…</p> : tab === 'plan' ? <Plan sessions={sessions} open={open} /> : tab === 'history' ? <History journal={journal} open={open} update={store.update} initialExpanded={expanded} /> : active ? <Workout key={active} journal={journal} sessionKey={active} update={store.update} finish={finish} showTechnique={setTechnique} /> : key ? (() => {const [w, d] = key.split('-').map(Number); return <Panel><p className="tag">{sessions[key] ? 'Начата' : 'Ближайшая тренировка'}</p><h2>{names[d]} · неделя {w}</h2><p>{workout(w, d, sessions[key]?.deferred).map(e => e.id === 'run' ? e.target : e.name).join(' → ')}</p><button className="primary" onClick={() => open(key)}>{sessions[key] ? 'Продолжить занятие' : 'Начать занятие'}</button></Panel>;})() : <Panel><h2>Цикл завершён</h2><button onClick={() => setTab('history')}>Открыть историю</button></Panel>}
    </div></main><nav className="bottom" aria-label="Разделы приложения"><div>{[['today','Сегодня'],['plan','План'],['history','История']].map(([id, label]) => <button key={id} aria-current={tab === id} onClick={() => {setTab(id); setActive(null); window.scrollTo(0, 0);}}>{label}</button>)}</div></nav>
    {technique && <Technique exercise={technique} close={() => setTechnique(null)} />}
  </>;
}
