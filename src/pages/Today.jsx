import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRightLeft, CalendarDays, CheckCheck} from 'lucide-react';
import {currentPlan, plannedWorkout, sessionDay, sessionName, sessionWorkout, weekdays} from '../../shared/plan.js';
import {dateLabel, localDateKey} from '../journal.js';
import {Panel} from '../components/Workout.jsx';
import {SelectField} from '../components/SelectField.jsx';
import {ErrorNotice} from '../components/ErrorNotice.jsx';

const finished = session => ['Выполнена', 'Облегчена'].includes(session.status);

export function Today({journal, sessions, open, onChoose}) {
  const [now, setNow] = useState(() => new Date());
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const today = localDateKey(now);
  useEffect(() => {setPicking(false); setPending(''); setError('');}, [today]);
  const weekday = weekdays[(now.getDay() + 6) % 7];
  const plan = currentPlan(journal.trainingV2?.plan);
  const workouts = plan.dayNames.map((name, day) => ({name, day, items: plannedWorkout(plan, day)})).filter(workout => workout.name && workout.items.length);
  const scheduled = workouts.find(workout => workout.name === weekday);
  const entries = Object.entries(sessions).sort((a, b) => b[1].date.localeCompare(a[1].date));
  const todayEntries = entries.filter(([, session]) => localDateKey(session.date) === today);
  const latest = todayEntries.find(([, session]) => session.status === 'Начата' || finished(session));
  const choice = journal.trainingV2?.dayChoices?.[today];
  const latestWorkout = latest && (workouts.find(workout => workout.day === sessionDay(...latest)) ?? {day: sessionDay(...latest), name: sessionName(...latest), items: sessionWorkout(journal, latest[0])});
  const selected = workouts.find(workout => workout.day === choice) ?? latestWorkout ?? scheduled;
  const selectedEntries = selected ? todayEntries.filter(([key, session]) => sessionDay(key, session) === selected.day) : [];
  const active = selectedEntries.find(([, session]) => session.status === 'Начата');
  const completed = selectedEntries.find(([, session]) => finished(session));
  const record = active ?? completed;
  const displayedItems = record ? sessionWorkout(journal, record[0]) : selected?.items;
  const remaining = entries.filter(([key, session]) => session.status === 'Начата' && key !== active?.[0]);
  const completedToday = todayEntries.filter(([key, session]) => finished(session) && key !== record?.[0]);
  const pendingWorkout = workouts.find(workout => String(workout.day) === pending);
  const showPicker = picking || !selected;

  function choose(event) {
    event.preventDefault(); setError('');
    if (!pendingWorkout) {setError('Выбери тренировку из списка.'); return;}
    try {
      onChoose(pendingWorkout.day);
      setPicking(false); setPending('');
    } catch (e) {setError(e.message || 'Не удалось выбрать тренировку. Попробуй ещё раз.');}
  }

  return <div className="today-page">
    <div className="today-heading"><p className="tag"><CalendarDays size={15} aria-hidden="true" />{now.toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'})}</p><h2>Сегодня</h2></div>
    <Panel className="today-workout">
      {selected ? <>
        <p className="tag">{active ? 'Тренировка начата' : completed ? 'Тренировка завершена' : selected.day === scheduled?.day ? 'По плану на сегодня' : 'Выбрано на сегодня'}</p>
        <h3>{record ? sessionName(...record) : selected.name}</h3>
        {selected.day !== scheduled?.day && !record && <p className="muted">Занятие из плана «{selected.name}» выбрано на сегодня.</p>}
        <ol className="today-exercises">{displayedItems.map(exercise => <li key={exercise.id} className={exercise.id === 'run' ? 'today-run' : undefined}><strong>{exercise.id === 'run' ? 'Бег' : exercise.name}</strong><span>{exercise.id === 'run' ? exercise.target : `${exercise.n} × ${exercise.reps}${exercise.weight ? ' · ' + exercise.weight : ''}`}</span></li>)}</ol>
        <div className="today-actions"><button type="button" className="primary" onClick={() => open(record ? record[0] : selected.day)}>{active ? 'Продолжить тренировку' : completed ? 'Открыть запись' : 'Начать тренировку'}</button>{workouts.some(workout => workout.day !== selected.day) && <button type="button" aria-expanded={picking} aria-controls="today-workout-picker" onClick={() => {setPicking(value => !value); setPending(''); setError('');}}><ArrowRightLeft size={16} aria-hidden="true" /> Выбрать другую</button>}</div>
      </> : <><h3>На сегодня тренировок нет</h3><p className="muted">{workouts.length ? 'Хочешь выполнить занятие из плана? Выбери тренировку ниже.' : 'Добавь занятия в план, чтобы выбрать тренировку на сегодня.'}</p>{!workouts.length && <Link to="/plan">Добавить занятие →</Link>}</>}
      {showPicker && workouts.length > 0 && <form id="today-workout-picker" className="today-picker" onSubmit={choose}>
        <label>Какую тренировку выполнить?<SelectField required value={pending} onChange={event => {setPending(event.target.value); setError('');}}><option value="" disabled>Выбрать тренировку</option>{workouts.filter(workout => workout.day !== selected?.day).map(workout => <option key={workout.day} value={workout.day}>{workout.name}</option>)}</SelectField></label>
        {pendingWorkout && <p className="today-choice-preview">{pendingWorkout.items.map(exercise => exercise.id === 'run' ? exercise.target : exercise.name).join(' → ')}</p>}
        <p className="muted">Выбор действует только сегодня и сохраняется в аккаунте.</p>
        <ErrorNotice title="Не удалось выбрать тренировку" message={error} />
        <div className="row"><button className="primary" type="submit" disabled={!pendingWorkout}>{selected ? 'Заменить на сегодня' : 'Выбрать на сегодня'}</button>{selected && <button type="button" onClick={() => {setPicking(false); setPending(''); setError('');}}>Отмена</button>}</div>
      </form>}
    </Panel>
    {completedToday.length > 0 && <Panel><h3 className="today-completed-heading"><CheckCheck size={19} aria-hidden="true" /> Выполнено сегодня</h3>{completedToday.map(([key, session]) => <Link className="today-record" key={key} to={'/workouts/' + key}><span>{sessionName(key, session)}</span><span className="muted">{session.status} →</span></Link>)}</Panel>}
    {remaining.length > 0 && <Panel><details><summary>Незавершённые тренировки · {remaining.length}</summary>{remaining.map(([key, session]) => <Link className="today-record" key={key} to={'/workouts/' + key}><span>{sessionName(key, session)}</span><span className="muted">{dateLabel(session.date)} →</span></Link>)}</details></Panel>}
    <p className="today-plan-link"><Link to="/plan">Посмотреть и изменить план →</Link></p>
  </div>;
}
