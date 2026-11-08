import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {Activity, CheckCheck, Dumbbell, Route} from 'lucide-react';
import {EX, names} from '../../shared/program.js';
import {dateLabel, describe, pace} from '../journal.js';
import {Panel} from '../components/Workout.jsx';
import {plannedSessions, weekPlan} from '../../shared/plan.js';
import {RunningProgress} from '../components/RunningProgress.jsx';

const number = value => value.toLocaleString('ru-RU', {maximumFractionDigits: 1});
const completed = session => ['Выполнена', 'Облегчена'].includes(session.status);
const tabs = [['overview', 'Общая информация'], ['exercises', 'Упражнения'], ['run', 'Бег']];
const records = session => Object.values(session.sets ?? {}).flatMap(sets => Object.values(sets)).filter(record => !record.skip);

export function Progress({sessions, plan}) {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'overview';
  function selectTab(value) {
    setParams(previous => {const next = new URLSearchParams(previous); next.set('tab', value); return next;}, {replace: true, preventScrollReset: true});
  }
  function navigateTabs(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(([id]) => id === tab);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex][0]);
    document.getElementById('progress-tab-' + tabs[nextIndex][0])?.focus();
  }
  const [metric, setMetric] = useState('workouts');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState('');
  const entries = Object.entries(sessions).sort((a, b) => a[1].date.localeCompare(b[1].date));
  const done = entries.filter(([, session]) => completed(session));
  const runs = entries.filter(([, session]) => session.run);
  const distance = runs.reduce((total, [, session]) => total + session.run.km, 0);
  const seconds = runs.reduce((total, [, session]) => total + session.run.sec, 0);
  const sets = entries.reduce((total, [, session]) => total + records(session).length, 0);
  const weeks = Array.from({length: 12}, (_, index) => {
    const week = index + 1;
    const items = entries.filter(([key]) => Number(key.split('-')[0]) === week);
    return {week, items, planned: weekPlan(plan, week).days.filter((day, index) => day.length || sessions[week + '-' + index]).length, workouts: items.filter(([, session]) => completed(session)).length, km: items.reduce((total, [, session]) => total + (session.run?.km ?? 0), 0)};
  });
  const max = Math.max(1, ...weeks.map(week => week[metric]));
  const exercises = Object.entries(EX).filter(([id]) => entries.some(([, session]) => Object.values(session.sets?.[id] ?? {}).some(record => !record.skip)));
  const exerciseSummaries = exercises.map(([id, exercise]) => {
    const rows = entries.flatMap(([, session]) => Object.values(session.sets?.[id] ?? {}).filter(record => !record.skip));
    const weighted = rows.filter(record => typeof record.kg === 'number' && record.kg > 0);
    const best = [...(weighted.length ? weighted : rows)].sort((a, b) => Number(b.kg) - Number(a.kg) || b.value - a.value)[0];
    return {id, name: exercise[0], best, weighted: weighted.length > 0, sets: rows.length, sessions: entries.filter(([, session]) => Object.values(session.sets?.[id] ?? {}).some(record => !record.skip)).length};
  });
  const exerciseId = exercises.some(([id]) => id === selectedExercise) ? selectedExercise : exercises[0]?.[0];
  const exerciseRows = exerciseId ? entries.flatMap(([key, session]) => {
    const rows = Object.values(session.sets?.[exerciseId] ?? {}).filter(record => !record.skip);
    if (!rows.length) return [];
    const weighted = rows.filter(record => typeof record.kg === 'number' && record.kg > 0);
    const best = [...(weighted.length ? weighted : rows)].sort((a, b) => (Number(b.kg) - Number(a.kg)) || b.value - a.value)[0];
    return [{key, date: best.date ?? session.date, best, count: rows.length}];
  }) : [];
  const weightedExercise = exerciseRows.some(row => typeof row.best.kg === 'number' && row.best.kg > 0);
  const exerciseValue = row => weightedExercise ? Number(row.best.kg) : row.best.value;
  const exerciseMax = Math.max(1, ...exerciseRows.map(exerciseValue));
  const week = selectedWeek ? weeks[selectedWeek - 1] : null;
  const recent = [...entries].reverse().slice(0, 6);

  return <div className="progress-page">
    <div className="progress-heading"><p className="tag">Каждая тренировка в счёт</p><h2>Прогресс</h2><p className="muted">Твои результаты за текущий цикл из 12 недель.</p></div>
    <div className="plan-tabs progress-tabs" role="tablist" aria-label="Разделы прогресса" onKeyDown={navigateTabs}>{tabs.map(([id, label]) => <button key={id} type="button" id={'progress-tab-' + id} role="tab" aria-selected={tab === id} aria-controls={'progress-panel-' + id} tabIndex={tab === id ? 0 : -1} onClick={() => selectTab(id)}>{label}</button>)}</div>
    <div id="progress-panel-overview" role="tabpanel" aria-labelledby="progress-tab-overview" tabIndex={0} hidden={tab !== 'overview'}>
    <div className="progress-stats">
      {[[CheckCheck, done.length, `из ${plannedSessions(plan, sessions)} тренировок`, 'Выполненные и облегчённые'], [Route, number(distance), 'километров бега', `${runs.length} беговых тренировок`], [Dumbbell, sets, 'силовых подходов', 'Без пропущенных подходов'], [Activity, distance ? pace(distance, seconds) : '—', 'средний темп бега', 'По общему времени и дистанции']].map(([Icon, value, label, hint]) => <Panel key={label} className="progress-stat"><Icon size={20} aria-hidden="true" /><strong>{value}</strong><span>{label}</span><small className="muted">{hint}</small></Panel>)}
    </div>
    {!entries.length && <Panel><h3>Здесь будет твой прогресс</h3><p className="muted">Сохрани первый подход или пробежку — результаты появятся автоматически. Завершённые тренировки отмечай статусом «Выполнена» или «Облегчена».</p><Link to="/today">К первой тренировке →</Link></Panel>}
    <Panel>
      <div className="progress-section-heading"><div><h3>Ритм по неделям</h3><p className="muted">Нажми на неделю, чтобы посмотреть результаты.</p></div><div className="progress-switch" role="group" aria-label="Показатель графика">{[['workouts', 'Тренировки'], ['km', 'Бег, км']].map(([id, label]) => <button type="button" key={id} aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>)}</div></div>
      <div className="progress-chart" role="group" aria-label={metric === 'km' ? 'Километры бега по неделям плана' : 'Завершённые тренировки по неделям плана'}>{weeks.map(item => <button type="button" className="progress-week" key={item.week} aria-pressed={selectedWeek === item.week} aria-label={`Неделя ${item.week}: ${number(item[metric])} ${metric === 'km' ? 'км' : 'тренировок'}`} onClick={() => setSelectedWeek(item.week)}><span className="progress-bar-value">{number(item[metric])}</span><span className="progress-bar-space"><span className={'progress-bar' + (item[metric] ? '' : ' is-empty')} style={{height: `${item[metric] / max * 100}%`}} /></span><span className="progress-week-label">{item.week}</span></button>)}</div>
      <p className="muted progress-chart-note">Недели плана · {metric === 'km' ? 'Весь сохранённый бег, включая начатые занятия.' : 'Учитываются статусы «Выполнена» и «Облегчена».'}</p>
      {week && <div className="progress-week-detail" aria-live="polite"><h3>Неделя {week.week}</h3><p>{week.workouts} из {week.planned} тренировок завершено · {number(week.km)} км бега</p>{week.items.length ? week.items.map(([key, session]) => <Link key={key} to={'/workouts/' + key}>{names[Number(key.split('-')[1])]} · {session.status} →</Link>) : <p className="muted">Записей за эту неделю пока нет.</p>}</div>}
    </Panel>
    <Panel><h3>Последние занятия</h3>{!recent.length ? <p className="muted">Ты ещё не начал ни одной тренировки.</p> : <div className="progress-recent">{recent.map(([key, session]) => <Link className="progress-session" key={key} to={'/workouts/' + key}><div><strong>{names[Number(key.split('-')[1])]} · неделя {key.split('-')[0]}</strong><span className="muted">{dateLabel(session.date)} · {records(session).length} подходов{session.run ? ` · ${number(session.run.km)} км` : ''}</span></div><span className={'progress-session-status' + (completed(session) ? ' is-complete' : '')}>{session.status}</span></Link>)}</div>}</Panel>
    </div>
    <div id="progress-panel-exercises" role="tabpanel" aria-labelledby="progress-tab-exercises" tabIndex={0} hidden={tab !== 'exercises'}>
    <Panel><h3>Какие упражнения ты делал</h3><p className="muted">Максимальный записанный вес за весь цикл. Вес гантели указан на одну руку; пропущенные подходы не учитываются.</p>
      {!exerciseSummaries.length ? <><p className="muted">Пока нет сохранённых подходов. После тренировки здесь появятся упражнения и твои результаты.</p><Link to="/today">К тренировке →</Link></> : <div className="progress-exercise-grid">{exerciseSummaries.map(exercise => <button type="button" key={exercise.id} className="progress-exercise-card" aria-pressed={exerciseId === exercise.id} onClick={() => setSelectedExercise(exercise.id)}><span className="progress-exercise-name">{exercise.name}</span><span className="progress-exercise-record">{exercise.weighted ? <>{number(exercise.best.kg)} <small>кг</small></> : <>{exercise.best.value} <small>{exercise.best.unit === 'sec' ? 'сек.' : 'повт.'}</small></>}</span><span className="progress-exercise-record-label">{exercise.weighted ? 'максимальный вес' : 'лучший результат без доп. веса'}</span><span className="progress-exercise-count">Подходов: {exercise.sets} · занятий: {exercise.sessions}</span></button>)}</div>}
    </Panel>
    <Panel><h3>Результаты в упражнениях</h3>{!exercises.length ? <p className="muted">После первого сохранённого подхода здесь появится история весов и повторений.</p> : <>
      <label className="progress-exercise-label">Упражнение<select value={exerciseId} onChange={event => setSelectedExercise(event.target.value)}>{exercises.map(([id, exercise]) => <option key={id} value={id}>{exercise[0]}</option>)}</select></label>
      <p className="muted progress-chart-note">{weightedExercise ? 'Самый большой записанный вес за занятие. При одинаковом весе показан подход с большим числом повторений. Вес гантели указан на одну руку.' : 'Лучший подход за занятие по числу повторений или времени удержания.'} Сравнивай результаты с учётом техники и усилия.</p>
      <div className="progress-exercise-history">{[...exerciseRows].reverse().map(row => <Link to={'/workouts/' + row.key} className="progress-result" key={row.key}><div><span>{dateLabel(row.date)} · неделя {row.key.split('-')[0]}</span><strong>{describe(row.best)}</strong></div><span className="progress-result-track" aria-hidden="true"><span style={{width: `${exerciseValue(row) / exerciseMax * 100}%`}} /></span></Link>)}</div>
    </>}</Panel>

    </div>
    <div id="progress-panel-run" role="tabpanel" aria-labelledby="progress-tab-run" tabIndex={0} hidden={tab !== 'run'}><RunningProgress sessions={sessions} plan={plan} /></div>
  </div>;
}
