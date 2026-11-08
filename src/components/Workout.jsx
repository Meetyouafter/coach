import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {FeelingPicker, FeelingBadge} from './FeelingPicker.jsx';
import {ErrorNotice} from './ErrorNotice.jsx';
import {ExerciseDialog} from '../exercises/ExerciseDialog.jsx';
import {ready} from '../../shared/program.js';
import {sessionWorkout, sessionName} from '../../shared/plan.js';
import {dateLabel, describeResult, exerciseSummary, itemDone, lastExerciseResults, numeric, pace, parseTime, validNumber} from '../journal.js';

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
function LiftForm({journal, sessionKey, session, exercise: e, save, advance, showTechnique}) {
  const summary = exerciseSummary(session, e.id);
  const previous = lastExerciseResults(journal, e.id, sessionKey)[0];
  const [error, setError] = useState('');
  const [values, setValues] = useState(() => ({n: summary?.n ?? e.n, kg: summary?.kg ?? '', value: summary?.value ?? '', feeling: summary?.feeling}));
  const field = key => value => {setValues(old => ({...old, [key]: value})); setError('');};
  function submit(event) {
    event.preventDefault();
    const n = String(values.n), kg = String(values.kg), reps = String(values.value);
    if (!validNumber(n, 1, 20, true) || !validNumber(kg, 0, 999) || !validNumber(reps, 1, 999, true)) {setError('Укажи количество подходов от 1 до 20, повторы или секунды от 1 до 999 и вес от 0 до 999 кг.'); return;}
    const result = {n: numeric(n), kg: numeric(kg), value: numeric(reps), unit: e.id === 'side' ? 'sec' : 'reps', date: new Date().toISOString(), ...(values.feeling ? {feeling: values.feeling} : {})};
    advance(save(s => {(s.results ??= {})[e.id] = result;}));
  }
  return <Panel><p className="tag">Итог упражнения</p><h2>{e.name}</h2><p className="muted">По плану: {e.n} × {e.reps} · {e.weight}</p><p className="exercise-result-hint">Заполни результат после всех подходов. Повторы и вес укажи для одного подхода; 0 кг — без дополнительного веса.</p>
    <button type="button" onClick={() => showTechnique(e)}>Техника</button>
    {previous && <div className="exercise-previous-result"><p>В прошлый раз · {dateLabel(previous.date)}</p><strong>{describeResult(previous)}</strong><FeelingBadge value={previous.feeling} /><button type="button" onClick={() => setValues(old => ({...old, n: previous.n, kg: previous.kg, value: previous.value}))}>Повторить значения</button></div>}
    <form id="workout-form" noValidate onSubmit={submit} className="exercise-result-form">
      <div className="grid"><Field label="Количество подходов" name="sets" mode="numeric" required value={values.n} onChange={field('n')} /><Field label={e.id === 'side' ? 'Секунды на сторону' : 'Повторы в подходе'} name="reps" mode="numeric" required value={values.value} onChange={field('value')} /><Field label="Вес, кг" name="kg" required value={values.kg} onChange={field('kg')} /></div>
      <FeelingPicker value={values.feeling} onChange={field('feeling')} />
    </form>
    <button type="button" onClick={() => advance(save(s => {(s.results ??= {})[e.id] = {skip: true, date: new Date().toISOString()};}))}>Пропустить упражнение</button>
    <ErrorNotice title="Итог не сохранён" message={error} />
  </Panel>;
}
function RunForm({session, exercise: e, save, advance}) {
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
  const session = journal.trainingV2.sessions[sessionKey];
  const list = sessionWorkout(journal, sessionKey);
  const [params] = useSearchParams();
  const requestedExercise = params.get('exercise');
  const requestedIndex = list.findIndex(exercise => exercise.id === requestedExercise);
  const [index, setIndex] = useState(() => {if (requestedIndex >= 0) return requestedIndex; const i = list.findIndex(e => !itemDone(session, e)); return i < 0 ? list.length : i;});
  useEffect(() => {if (requestedIndex >= 0) setIndex(requestedIndex);}, [requestedExercise, requestedIndex]);
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
  return <><Panel><h2>{sessionName(sessionKey, session)}</h2><p>{session.status} · {complete} из {list.length} блоков</p><progress aria-label="Выполненные блоки" max={list.length} value={complete} /><details><summary>Упражнения и переход к блоку</summary><div className="row">{list.map((e, i) => <button key={e.id} aria-current={i === index} onClick={() => setIndex(i)}>{itemDone(session, e) ? '✓ ' : ''}{e.name}</button>)}</div></details></Panel>
    {!e ? <Panel><h2>Подведи итог</h2><p>Проверь итоги упражнений и выбери статус тренировки.</p></Panel> : e.id === 'run' ? <RunForm key={sessionKey + e.id} session={session} exercise={e} save={save} advance={advance} /> : <LiftForm key={sessionKey + e.id} journal={journal} sessionKey={sessionKey} session={session} exercise={e} save={save} advance={advance} showTechnique={showTechnique} />}
    <Panel><h3>Статус тренировки</h3>{statuses.map(status => <button key={status} aria-current={session.status === status} onClick={() => {save(s => {s.status = status; s.finished = status === 'Начата' ? null : new Date().toISOString();}); if (status !== 'Начата') finish();}}>{status}</button>)}</Panel>
    {e && <div className="bottom workout-action"><button className="primary action" type="submit" form="workout-form">{e.id === 'run' ? 'Сохранить бег' : 'Сохранить итог упражнения'}</button></div>}
  </>;
}
