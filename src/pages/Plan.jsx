import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {W, names, ready} from '../../shared/program.js';
import {Panel} from '../components/Workout.jsx';
import {PlanEditor} from '../components/PlanEditor.jsx';
import {plannedWorkout, weekPlan} from '../../shared/plan.js';

export function Plan({sessions, open, plan, onSave}) {
  const [editing, setEditing] = useState(null);
  const [saved, setSaved] = useState(false);
  const [params, setParams] = useSearchParams();
  const requestedWeek = Number(params.get('week') ?? 1);
  const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 12 ? requestedWeek : 1;
  const tab = params.get('tab') === 'run' ? 'run' : 'exercises';
  const current = weekPlan(plan, week);
  const weekOptions = W.map((_, index) => {
    const value = weekPlan(plan, index + 1);
    return {week: index + 1, km: value.kmMin === value.kmMax ? value.kmMin : value.kmMin + '–' + value.kmMax};
  });
  async function save(value) {await onSave(value); setEditing(null); setSaved(true);}
  function startEditing(mode) {setEditing(mode); setSaved(false);}
  function setWeek(value) {setParams(previous => {const next = new URLSearchParams(previous); next.set('week', String(value)); return next;});}
  function setTab(value) {setParams(previous => {const next = new URLSearchParams(previous); next.set('tab', value); return next;}, {replace: true, preventScrollReset: true});}
  function navigateTabs(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'exercises' : event.key === 'End' ? 'run' : tab === 'run' ? 'exercises' : 'run';
    setTab(next);
    document.getElementById('plan-tab-' + next)?.focus();
  }
  return <><Panel><h2>{plan?.name ?? 'План на 12 недель'}</h2>{!editing && <div className="row plan-page-actions"><button type="button" className="primary" onClick={() => startEditing('edit')}>Редактировать план</button><button type="button" onClick={() => startEditing('new')}>Составить с нуля</button></div>}{saved && <p className="plan-save-success" role="status">План сохранён в аккаунте.</p>}<select aria-label="Неделя плана" value={week} onChange={e => setWeek(Number(e.target.value))}>{weekOptions.map(option => <option key={option.week} value={option.week}>Неделя {option.week} · ≈ {option.km} км</option>)}</select>
    <div className="plan-tabs" role="tablist" aria-label="Часть тренировочного плана" onKeyDown={navigateTabs}>{[['exercises', 'Упражнения'], ['run', 'Бег']].map(([id, label]) => <button key={id} type="button" id={'plan-tab-' + id} role="tab" aria-selected={tab === id} aria-controls={'plan-panel-' + id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{label}</button>)}</div>
    {!editing && current.note && <p className="muted">{current.note}</p>}</Panel>
    {editing ? <PlanEditor key={editing} plan={plan} week={week} tab={tab} blank={editing === 'new'} onSave={save} onCancel={() => setEditing(null)} /> : <div key={tab} id={'plan-panel-' + tab} role="tabpanel" aria-labelledby={'plan-tab-' + tab} tabIndex={0}>
    {names.map((name, day) => {
      const items = plannedWorkout(plan, week, day);
      const visible = items.filter(item => tab === 'run' ? item.id === 'run' : item.id !== 'run');
      return <Panel key={day}><h3>{name}</h3>{!visible.length && <p className="muted">{!items.length ? 'День отдыха' : tab === 'run' ? 'Бег не запланирован.' : 'Силовых упражнений нет.'}</p>}{visible.map(e => e.id === 'run' ? <div key={e.id}><p className="run">{e.target}</p><p className="muted">{e.tip}</p>{e.test && <p>{ready}</p>}</div> : <p key={e.id}>{e.name} · {e.n} × {e.reps} · {e.weight}{e.rir ? ' · запас: ' + (e.rir === '4+' ? 'от 4 повторений' : e.rir + ' повторения') : ''}</p>)}{(items.length > 0 || sessions[week + '-' + day]) && <button onClick={() => open(week + '-' + day)}>{sessions[week + '-' + day] ? 'Открыть занятие' : 'Начать занятие'}</button>}</Panel>;
    })}
    {tab === 'exercises' && <>
    <Panel><h3>Что значит запас повторений</h3><p>Это сколько повторений ты смог бы сделать ещё с правильной техникой после окончания подхода. Запас 3–4 — заканчивай, когда чувствуешь, что сможешь сделать ещё 3–4 повторения.</p><p className="muted">Например: сделал 10 повторений, но мог бы сделать всего 13–14. Значит, осталось 3–4 повторения в запасе. Проверять это дополнительными повторениями не нужно.</p></Panel>
    <Panel><h3>Как прибавлять</h3><p>Сначала добавляй повторы. Когда два занятия подряд все подходы на верхней границе с правильной техникой и запасом минимум в 2 повторения, прибавь минимальный вес и вернись к нижней границе. Если две тренировки подряд падают повторы или ноги тяжёлые дольше двух суток, повтори этап или облегчи неделю. Вес гантели указан на одну руку.</p><p>Разминка перед силовой 5–8 мин и 1–3 пробных подхода. Отдых 2–3 мин в основных движениях, 90–120 сек в остальных, 30–60 сек на пресс.</p></Panel>
    </>}
    </div>}
  </>;
}
