import {useSearchParams} from 'react-router-dom';
import {W, names, phases, ready, workout} from '../../shared/program.js';
import {Panel} from '../components/Workout.jsx';

export function Plan({sessions, open}) {
  const [params, setParams] = useSearchParams();
  const requestedWeek = Number(params.get('week') ?? 1);
  const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 12 ? requestedWeek : 1;
  function setWeek(value) {setParams({week: String(value)});}
  return <><Panel><h2>План на 12 недель</h2><select aria-label="Неделя плана" value={week} onChange={e => setWeek(Number(e.target.value))}>{W.map((w, i) => <option key={i} value={i + 1}>Неделя {i + 1} · ≈ {w[4]} км</option>)}</select><p className="muted">{phases[week - 1]}</p></Panel>
    {names.map((name, day) => <Panel key={day}><h3>{name}</h3>{workout(week, day, sessions[week + '-' + day]?.deferred).map(e => e.id === 'run' ? <div key={e.id}><p className="run">{e.target}</p><p className="muted">{e.tip}</p></div> : <p key={e.id}>{e.name} · {e.n} × {e.reps} · {e.weight}{e.rir ? ' · RIR ' + e.rir : ''}</p>)}{week === 12 && day === 3 && <p>{ready}</p>}<button onClick={() => open(week + '-' + day)}>{sessions[week + '-' + day] ? 'Открыть занятие' : 'Начать занятие'}</button></Panel>)}
    <Panel><h3>Как прибавлять</h3><p>Сначала добавляй повторы. Когда два занятия подряд все подходы на верхней границе с чистой техникой и минимум 2 RIR, прибавь минимальный вес и вернись к нижней границе. Если две тренировки подряд падают повторы или ноги тяжёлые дольше двух суток, повтори этап или облегчи неделю. Вес гантели указан на одну руку.</p><p>Разминка перед силовой 5–8 мин и 1–3 пробных подхода. Отдых 2–3 мин в основных движениях, 90–120 сек в остальных, 30–60 сек на пресс.</p></Panel>
  </>;
}
