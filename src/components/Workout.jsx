import {useEffect, useState} from 'react';
import {ErrorNotice} from './ErrorNotice.jsx';
import {ExerciseDialog} from '../exercises/ExerciseDialog.jsx';
import {names, ready} from '../../shared/program.js';
import {sessionWorkout} from '../../shared/plan.js';
import {dateLabel, describe, itemDone, lastRows, numeric, pace, parseTime, validNumber} from '../journal.js';

export const statuses = ['Начата', 'Выполнена', 'Облегчена', 'Пропущена'];
export function Panel({children, className = ''}) {return <section className={'panel ' + className}>{children}</section>;}
export function Technique({exercise, close, browse}) {
  return <ExerciseDialog exercise={exercise} onClose={close} onBrowse={browse} />;
}
export function RestTimer({until, setUntil}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setInterval(() => {setNow(Date.now()); if (Date.now() >= until) clearInterval(timer);}, 500);
    return () => clearInterval(timer);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  if (!left) return null;
  return <Panel className="row timer"><strong role="timer">Отдых · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong><button onClick={() => setUntil(0)}>Пропустить</button><button onClick={() => setUntil(Math.max(until, Date.now()) + 30000)}>+30 сек</button></Panel>;
}
function Field({label, name, value, onChange, required = false, mode = 'decimal'}) {
  return <label>{label}<input name={name} inputMode={mode} required={required} value={value ?? ''} onChange={event => onChange(event.target.value)} /></label>;
}
function LiftForm({journal, sessionKey, session, exercise: e, save, advance, setUntil, showTechnique}) {
  const records = session.sets[e.id] ?? {};
  const [slot, setSlot] = useState(() => Array.from({length: e.n}, (_, i) => i).find(i => !records[i]) ?? 0);
  const [error, setError] = useState('');
  const [values, setValues] = useState(records[slot] ?? {kg: '', value: '', effort: ''});
  const length = Math.max(e.n, slot + 1, ...Object.keys(records).map(i => Number(i) + 1));
  const previousRows = lastRows(journal, e.id, sessionKey);
  const previous = previousRows.find(row => row.i === slot) ?? previousRows[0];
  const select = i => {setSlot(i); setValues(records[i] ?? {kg: '', value: '', effort: ''}); setError('');};
  const field = key => value => {setValues(old => ({...old, [key]: value})); setError('');};
  function submit(event) {
    event.preventDefault();
    const kg = String(values.kg ?? ''), reps = String(values.value ?? ''), effort = String(values.effort ?? '');
    if ((kg && !validNumber(kg, 0, 999)) || !validNumber(reps, 1, 999, true) || !validNumber(effort, 1, 10, true)) {setError('Укажи корректный вес, повторы или секунды и усилие от 1 до 10.'); return;}
    const record = {kg: kg ? numeric(kg) : '', value: numeric(reps), effort: numeric(effort), unit: e.id === 'side' ? 'sec' : 'reps', date: new Date().toISOString()};
    const nextSession = save(s => {(s.sets[e.id] ??= {})[slot] = record;});
    setUntil(Date.now() + e.rest * 1000);
    const next = Array.from({length: e.n}, (_, i) => i).find(i => !nextSession.sets[e.id][i]);
    if (next === undefined) advance(nextSession);
    else {setSlot(next); setValues(nextSession.sets[e.id][next] ?? {kg: '', value: '', effort: ''}); setError('');}
  }
  return <Panel><h2>{e.name}</h2><p>{e.n} × {e.reps} · старт {e.weight}</p><p className="muted">{e.rir ? 'Заканчивай подход, когда чувствуешь, что сможешь сделать ещё ' + (e.rir === '4+' ? 'минимум 4' : e.rir) + ' повторения с правильной техникой.' : 'Дополнительное упражнение'}</p>
    <button onClick={() => showTechnique(e)}>Техника</button>
    <div className="row slots">{Array.from({length}, (_, i) => <button key={i} aria-current={i === slot} onClick={() => select(i)}>{i + 1}{records[i]?.skip ? ' · пропуск' : records[i] ? ' ✓' : ''}</button>)}</div>
    <h3>Подход № {slot + 1}</h3>
    {previous ? <><p className="muted">Прошлый подход № {previous.i + 1} · {previous.date ? dateLabel(previous.date) : previous.k} · {describe(previous)}</p><button onClick={() => setValues({kg: previous.kg ?? '', value: previous.value ?? '', effort: previous.effort ?? ''})}>Повторить значения</button></> : <p className="muted">Предыдущих подходов пока нет</p>}
    <form id="workout-form" className="grid" noValidate onSubmit={submit}>
      <Field label="Вес, кг" name="kg" value={values.kg} onChange={field('kg')} />
      <Field label={e.id === 'side' ? 'Секунды на сторону' : 'Повторы'} name="reps" mode="numeric" required value={values.value} onChange={field('value')} />
      <Field label="Усилие 1–10" name="effort" mode="numeric" required value={values.effort} onChange={field('effort')} />
    </form>
    <div className="row"><button disabled={length >= 20} onClick={() => select(length)}>Добавить подход</button><button onClick={() => {
      if (slot >= e.n) {setError('Пропуск доступен для запланированных подходов.'); return;}
      advance(save(s => {(s.sets[e.id] ??= {})[slot] = {skip: true, date: new Date().toISOString()};}));
    }}>Пропустить подход</button></div><ErrorNotice title="Подход не сохранён" message={error} />
  </Panel>;
}
function RunForm({session, exercise: e, week, day, save, advance}) {
  const [values, setValues] = useState(session.run ?? {km: '', time: '', pulse: '', incline: '', effort: ''});
  const [error, setError] = useState('');
  const field = key => value => {setValues(old => ({...old, [key]: value})); setError('');};
  const km = String(values.km), time = String(values.time), pulse = String(values.pulse), incline = String(values.incline), effort = String(values.effort);
  const seconds = parseTime(time);
  function submit(event) {
    event.preventDefault();
    if (!validNumber(km, .01, 200) || time.trim().length > 24 || !(seconds >= .01 && seconds <= 86400) || !validNumber(effort, 1, 10, true) || (pulse && !validNumber(pulse, 20, 260, true)) || (incline && !validNumber(incline, -10, 45))) {setError('Проверь дистанцию, время, пульс, наклон и усилие.'); return;}
    advance(save(s => {s.run = {km: numeric(km), time: time.trim(), sec: seconds, pulse: pulse ? numeric(pulse) : '', incline: incline ? numeric(incline) : '', effort: numeric(effort)};}));
  }
  return <Panel><h2 className="run">{e.name}</h2><p><strong>{e.target}</strong></p><p>{e.tip}</p>
    <form id="workout-form" className="grid" noValidate onSubmit={submit}>
      <Field label="Дистанция, км" name="km" required value={km} onChange={field('km')} />
      <Field label="Время, мин или мм:сс" name="time" mode="text" required value={time} onChange={field('time')} />
      <Field label="Средний пульс" name="pulse" mode="numeric" value={pulse} onChange={field('pulse')} />
      <Field label="Наклон, %" name="incline" value={incline} onChange={field('incline')} />
      <Field label="Усилие 1–10" name="effort" mode="numeric" required value={effort} onChange={field('effort')} />
    </form>
    <p className="run">{numeric(km) > 0 && seconds > 0 ? 'Средний темп ' + pace(numeric(km), seconds) : ''}</p>
    {e.test && <>{!session.deferred && <p>{ready}</p>}<button onClick={() => save(s => {s.deferred = !s.deferred;})}>{session.deferred ? 'Вернуть тест' : 'Перенести тест'}</button></>}
    <ErrorNotice title="Бег не сохранён" message={error} />
  </Panel>;
}
export function Workout({journal, sessionKey, update, finish, showTechnique}) {
  const [week, day] = sessionKey.split('-').map(Number);
  const session = journal.trainingV2.sessions[sessionKey];
  const list = sessionWorkout(journal, week, day);
  const [index, setIndex] = useState(() => {const i = list.findIndex(e => !itemDone(session, e)); return i < 0 ? list.length : i;});
  const [until, setUntil] = useState(0);
  const save = change => {
    let next;
    update(j => {next = j.trainingV2.sessions[sessionKey]; change(next);});
    return next;
  };
  const advance = s => {
    let next = list.findIndex((e, i) => i > index && !itemDone(s, e));
    if (next < 0) next = list.findIndex(e => !itemDone(s, e));
    setIndex(next < 0 ? list.length : next);
  };
  const e = list[index];
  const complete = list.filter(e => itemDone(session, e)).length;
  return <><Panel><h2>{names[day]} · неделя {week}</h2><p>{session.status} · {complete} из {list.length} блоков</p><progress aria-label="Выполненные блоки" max={list.length} value={complete} /><details><summary>Упражнения и переход к блоку</summary><div className="row">{list.map((e, i) => <button key={e.id} aria-current={i === index} onClick={() => setIndex(i)}>{itemDone(session, e) ? '✓ ' : ''}{e.name}</button>)}</div></details></Panel>
    <RestTimer until={until} setUntil={setUntil} />
    {!e ? <Panel><h2>Подведи итог</h2><p>Проверь сохранённые подходы и выбери статус тренировки.</p></Panel> : e.id === 'run' ? <RunForm key={sessionKey + e.id} session={session} exercise={e} week={week} day={day} save={save} advance={advance} /> : <LiftForm key={sessionKey + e.id} journal={journal} sessionKey={sessionKey} session={session} exercise={e} save={save} advance={advance} setUntil={setUntil} showTechnique={showTechnique} />}
    <Panel><h3>Статус тренировки</h3>{statuses.map(status => <button key={status} aria-current={session.status === status} onClick={() => {save(s => {s.status = status; s.finished = status === 'Начата' ? null : new Date().toISOString();}); if (status !== 'Начата') finish();}}>{status}</button>)}</Panel>
    {e && <div className="bottom workout-action"><button className="primary action" type="submit" form="workout-form">{e.id === 'run' ? 'Сохранить бег' : 'Сохранить подход'}</button></div>}
  </>;
}
