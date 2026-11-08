import {Link} from 'react-router-dom';
import {names} from '../../shared/program.js';
import {plannedWorkout, sessionWorkout} from '../../shared/plan.js';
import {Panel} from '../components/Workout.jsx';

function nextKey(sessions, plan) {
  const ongoing = Object.keys(sessions).filter(k => sessions[k].status === 'Начата').sort((a, b) => sessions[b].date.localeCompare(sessions[a].date));
  if (ongoing.length) return ongoing[0];
  for (let w = 1; w <= 12; w++) for (let d = 0; d < names.length; d++) if (!sessions[w + '-' + d] && plannedWorkout(plan, w, d).length) return w + '-' + d;
  return null;
}
export function Today({journal, sessions, open}) {
  const key = nextKey(sessions, journal.trainingV2?.plan);
  if (!key) return <Panel><h2>{Object.keys(sessions).length ? 'Цикл завершён' : 'Добавь тренировки в план'}</h2><Link to="/plan">Открыть план</Link></Panel>;
  const [week, day] = key.split('-').map(Number);
  return <Panel><p className="tag">{sessions[key] ? 'Начата' : 'Ближайшая тренировка'}</p><h2>{names[day]} · неделя {week}</h2><p>{sessionWorkout(journal, week, day).map(exercise => exercise.id === 'run' ? exercise.target : exercise.name).join(' → ')}</p><button className="primary" onClick={() => open(key)}>{sessions[key] ? 'Продолжить занятие' : 'Начать занятие'}</button></Panel>;
}
