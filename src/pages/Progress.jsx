import {useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {Activity, CheckCheck, Dumbbell, Route} from 'lucide-react';
import {EX} from '../../shared/program.js';
import {dateLabel, describeResult, exerciseSummary, sessionResults, sessionSetCount, pace} from '../journal.js';
import {Panel} from '../components/Workout.jsx';
import {sessionName, sessionWorkout} from '../../shared/plan.js';
import {RunningProgress} from '../components/RunningProgress.jsx';
import {FeelingBadge} from '../components/FeelingPicker.jsx';
import {SelectField} from '../components/SelectField.jsx';

const number = value => value.toLocaleString('ru-RU', {maximumFractionDigits: 1});
const completed = session => ['Выполнена', 'Облегчена'].includes(session.status);
const tabs = [['overview', 'Общая информация'], ['exercises', 'Упражнения'], ['run', 'Бег']];

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
  const [selectedExercise, setSelectedExercise] = useState('');
  const entries = Object.entries(sessions).sort((a, b) => a[1].date.localeCompare(b[1].date));
  const done = entries.filter(([, session]) => completed(session));
  const runs = entries.filter(([, session]) => session.run);
  const distance = runs.reduce((total, [, session]) => total + session.run.km, 0);
  const seconds = runs.reduce((total, [, session]) => total + session.run.sec, 0);
  const sets = entries.reduce((total, [, session]) => total + sessionSetCount(session), 0);
  const resultRows = entries.flatMap(([key, session]) => sessionResults(session).map(result => ({...result, key})));
  const exercises = Object.entries(EX).filter(([id]) => resultRows.some(row => row.id === id));
  const exerciseSummaries = exercises.map(([id, exercise]) => {
    const rows = resultRows.filter(row => row.id === id);
    const best = [...rows].sort((a, b) => b.maxKg - a.maxKg || (b.valueRange?.[1] ?? b.value) - (a.valueRange?.[1] ?? a.value))[0];
    return {id, name: exercise[0], best, weighted: best.maxKg > 0, sets: rows.reduce((sum, row) => sum + row.n, 0), sessions: rows.length};
  });
  const exerciseId = exercises.some(([id]) => id === selectedExercise) ? selectedExercise : exercises[0]?.[0];
  const exerciseRows = resultRows.filter(row => row.id === exerciseId);
  const weightedExercise = exerciseRows.some(row => row.maxKg > 0);
  const exerciseValue = row => weightedExercise ? row.maxKg : row.valueRange?.[1] ?? row.value;
  const exerciseMax = Math.max(1, ...exerciseRows.map(exerciseValue));
  const journal = {trainingV2: {plan, sessions}};
  const recent = [...entries].reverse().slice(0, 6);

  return <div className="progress-page">
    <div className="progress-heading"><p className="tag">Каждая тренировка в счёт</p><h2>Прогресс</h2><p className="muted">Твои результаты по сохранённым тренировкам.</p></div>
    <div className="plan-tabs progress-tabs" role="tablist" aria-label="Разделы прогресса" onKeyDown={navigateTabs}>{tabs.map(([id, label]) => <button key={id} type="button" id={'progress-tab-' + id} role="tab" aria-selected={tab === id} aria-controls={'progress-panel-' + id} tabIndex={tab === id ? 0 : -1} onClick={() => selectTab(id)}>{label}</button>)}</div>
    <div id="progress-panel-overview" role="tabpanel" aria-labelledby="progress-tab-overview" tabIndex={0} hidden={tab !== 'overview'}>
    <div className="progress-stats">
      {[[CheckCheck, done.length, 'тренировок завершено', 'Выполненные и облегчённые'], [Route, number(distance), 'километров бега', `${runs.length} беговых тренировок`], [Dumbbell, sets, 'силовых подходов', 'Без пропущенных подходов'], [Activity, distance ? pace(distance, seconds) : '—', 'средний темп бега', 'По общему времени и дистанции']].map(([Icon, value, label, hint]) => <Panel key={label} className="progress-stat"><Icon size={20} aria-hidden="true" /><strong>{value}</strong><span>{label}</span><small className="muted">{hint}</small></Panel>)}
    </div>
    {!entries.length && <Panel><h3>Здесь будет твой прогресс</h3><p className="muted">Сохрани первый итог упражнения или пробежку — результаты появятся автоматически. Завершённые тренировки отмечай статусом «Выполнена» или «Облегчена».</p><Link to="/today">К первой тренировке →</Link></Panel>}
    <Panel><h3>Последние занятия</h3>{!recent.length ? <p className="muted">Ты ещё не начал ни одной тренировки.</p> : <div className="progress-recent">{recent.map(([key, session]) => <Link className="progress-session" key={key} to={'/workouts/' + key}><div><strong>{sessionName(key, session)}</strong><span className="muted">{dateLabel(session.date)} · {sessionSetCount(session)} подходов{session.run ? ` · ${number(session.run.km)} км` : ''}</span></div><span className={'progress-session-status' + (completed(session) ? ' is-complete' : '')}>{session.status}</span></Link>)}</div>}</Panel>
    </div>
    <div id="progress-panel-exercises" role="tabpanel" aria-labelledby="progress-tab-exercises" tabIndex={0} hidden={tab !== 'exercises'}>
    <Panel><h3>Итоги тренировок</h3><p className="muted">Записывай один итог для каждого упражнения: подходы, повторы и вес. Оценка самочувствия необязательна.</p>
      {!entries.length ? <p className="muted">Начни тренировку в разделе «Сегодня» — здесь появится запись.</p> : [...entries].reverse().map(([key, session]) => {
        const planned = sessionWorkout(journal, key).filter(exercise => exercise.id !== 'run');
        const ids = [...new Set([...planned.map(exercise => exercise.id), ...sessionResults(session).map(result => result.id)])];
        return <details className="progress-training-results" key={key}><summary><strong>{sessionName(key, session)}</strong><span>{dateLabel(session.date)} · {session.status}</span></summary>
          {!ids.length ? <p className="muted">В этой тренировке нет силовых упражнений.</p> : ids.map(id => {
            const result = exerciseSummary(session, id);
            return <div className="progress-training-exercise" key={id}><div><strong>{EX[id]?.[0] ?? id}</strong><span>{result ? describeResult(result) : session.results?.[id]?.skip ? 'Пропущено' : 'Итог не записан'}</span><FeelingBadge value={result?.feeling} /></div><Link to={'/workouts/' + key + '?exercise=' + id}>{result ? 'Изменить итог' : 'Записать итог'} →</Link></div>;
          })}
        </details>;
      })}
    </Panel>
    <Panel><h3>Какие упражнения ты делал</h3><p className="muted">Максимальный записанный вес за всё время. Вес гантели указан на одну руку; пропущенные подходы не учитываются.</p>
      {!exerciseSummaries.length ? <><p className="muted">Пока нет итогов упражнений. После сохранения итогов здесь появятся упражнения и твои результаты.</p><Link to="/today">К тренировке →</Link></> : <div className="progress-exercise-grid">{exerciseSummaries.map(exercise => <button type="button" key={exercise.id} className="progress-exercise-card" aria-pressed={exerciseId === exercise.id} onClick={() => setSelectedExercise(exercise.id)}><span className="progress-exercise-name">{exercise.name}</span><span className="progress-exercise-record">{exercise.weighted ? <>{number(exercise.best.maxKg)} <small>кг</small></> : <>{exercise.best.valueRange?.[1] ?? exercise.best.value} <small>{exercise.best.unit === 'sec' ? 'сек.' : 'повт.'}</small></>}</span><span className="progress-exercise-record-label">{exercise.weighted ? 'максимальный вес' : 'лучший результат'}</span><span className="progress-exercise-count">Подходов: {exercise.sets} · занятий: {exercise.sessions}</span></button>)}</div>}
    </Panel>
    <Panel><h3>Результаты в упражнениях</h3>{!exercises.length ? <p className="muted">После первого итога здесь появится история подходов, повторений и веса.</p> : <>
      <label className="progress-exercise-label">Упражнение<SelectField value={exerciseId} onChange={event => setSelectedExercise(event.target.value)}>{exercises.map(([id, exercise]) => <option key={id} value={id}>{exercise[0]}</option>)}</SelectField></label>
      <p className="muted progress-chart-note">Один итог на упражнение за тренировку: количество подходов, повторы и вес. Самочувствие указывается по желанию. Для прежних записей показан диапазон значений.</p>
      <div className="progress-exercise-history">{[...exerciseRows].reverse().map(row => <Link to={'/workouts/' + row.key + '?exercise=' + exerciseId} className="progress-result" key={row.key}><div><span>{dateLabel(row.date)}</span><strong>{describeResult(row)}</strong></div><FeelingBadge value={row.feeling} /><span className="progress-result-track" aria-hidden="true"><span style={{width: `${exerciseValue(row) / exerciseMax * 100}%`}} /></span></Link>)}</div>
    </>}</Panel>

    </div>
    <div id="progress-panel-run" role="tabpanel" aria-labelledby="progress-tab-run" tabIndex={0} hidden={tab !== 'run'}><RunningProgress sessions={sessions} plan={plan} /></div>
  </div>;
}
