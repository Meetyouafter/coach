import {useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Plus, Pencil, Trash2} from 'lucide-react';
import {ErrorNotice} from '../components/ErrorNotice.jsx';
import {Panel} from '../components/Workout.jsx';
import {PlanEditor} from '../components/PlanEditor.jsx';
import {DeleteWorkoutDialog} from '../components/DeleteWorkoutDialog.jsx';
import {plannedWorkout, currentPlan, sessionDay, weekdays} from '../../shared/plan.js';

const tabs = [['general', 'Общий'], ['exercises', 'Упражнения'], ['run', 'Бег']];

export function Plan({sessions, open, plan, onSave}) {
  const [editing, setEditing] = useState(null);
  const [saved, setSaved] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'general';
  const current = currentPlan(plan);
  const hasFreeDay = weekdays.some(name => !current.dayNames.includes(name));
  async function save(value) {await onSave(value); setEditing(null); setSaved('Занятие сохранено.');}
  function startEditing(day, isNew = false, initialWeekday = '') {setEditing({day, isNew, initialWeekday}); setSaved(''); setDeleting(null); setError('');}
  async function remove(day) {
    setBusy(true); setError('');
    try {
      const next = currentPlan(plan);
      next.days[day] = [];
      next.dayNames[day] = '';
      await onSave(next);
      setDeleting(null); setSaved('Занятие удалено из плана.');
    } catch (e) {setError(e.message || 'Не удалось удалить занятие. Попробуй снова.');}
    finally {setBusy(false);}
  }
  function setTab(value) {setParams(previous => {const next = new URLSearchParams(previous); next.set('tab', value); return next;}, {replace: true, preventScrollReset: true});}
  function navigateTabs(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(([id]) => id === tab);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex][0];
    setTab(next);
    document.getElementById('plan-tab-' + next)?.focus();
  }
  return <><Panel><h2>{current.name}</h2>{!editing && <div className="row plan-page-actions"><button type="button" className="primary" disabled={busy || !hasFreeDay || current.days.length >= 100} onClick={() => startEditing(current.days.length, true)}><Plus size={17} aria-hidden="true" /> Добавить занятие</button>{!hasFreeDay && <span className="muted">На каждый день недели уже запланировано занятие.</span>}</div>}{saved && <p className="plan-save-success" role="status">{saved}</p>}{!deleting && <ErrorNotice title="Не удалось изменить план" message={error} />}
    <div className="plan-tabs" role="tablist" aria-label="Часть тренировочного плана" onKeyDown={navigateTabs}>{tabs.map(([id, label]) => <button key={id} type="button" id={'plan-tab-' + id} role="tab" aria-selected={tab === id} aria-controls={'plan-panel-' + id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{label}</button>)}</div>
    {!editing && current.note && <p className="muted">{current.note}</p>}</Panel>
    {editing ? <PlanEditor key={editing.day} plan={plan} tab={tab} day={editing.day} isNew={editing.isNew} initialWeekday={editing.initialWeekday} onSave={save} onCancel={() => setEditing(null)} /> : <div key={tab} id={'plan-panel-' + tab} role="tabpanel" aria-labelledby={'plan-tab-' + tab} tabIndex={0}>
    {[...weekdays.map(name => ({name, day: current.dayNames.indexOf(name)})), ...current.dayNames.flatMap((name, day) => name && !weekdays.includes(name) ? [{name, day}] : [])].map(({name, day}) => {
      if (day < 0) return <Panel key={name} className="plan-rest-day"><div className="plan-workout-heading"><h3>{name}</h3><button type="button" className="icon-button" disabled={busy || current.days.length >= 100} title="Добавить занятие" aria-label={'Добавить занятие: ' + name} onClick={() => startEditing(current.days.length, true, name)}><Plus size={18} aria-hidden="true" /></button></div><p className="muted">Выходной</p></Panel>;
      const items = plannedWorkout(plan, day);
      const visible = items.filter(item => tab === 'general' || (tab === 'run' ? item.id === 'run' : item.id !== 'run'));
      return <Panel key={day}><div className="plan-workout-heading"><h3>{name}</h3><div className="row"><button type="button" disabled={busy} className="icon-button" title="Редактировать" onClick={() => startEditing(day)} aria-label={'Редактировать занятие: ' + name}><Pencil size={18} aria-hidden="true" /></button><button type="button" disabled={busy} className="icon-button" title="Удалить" onClick={() => {setDeleting({day, name}); setSaved(''); setError('');}} aria-label={'Удалить занятие: ' + name}><Trash2 size={18} aria-hidden="true" /></button></div></div>{!visible.length && <p className="muted">{!items.length ? 'Выходной' : tab === 'run' ? 'Бег не запланирован.' : 'Силовых упражнений нет.'}</p>}{visible.map(e => e.id === 'run' ? <div key={e.id}><p className="run">{e.target}</p><p className="muted">{e.tip}</p></div> : <p key={e.id}>{e.name} · {e.n} × {e.reps} · {e.weight}{e.rir ? ' · запас: ' + (e.rir === '4+' ? 'от 4 повторений' : e.rir + ' повторения') : ''}</p>)}{items.length > 0 && <button disabled={busy} onClick={() => open(day)}>{Object.entries(sessions).some(([key, session]) => sessionDay(key, session) === day && session.status === 'Начата') ? 'Продолжить занятие' : 'Начать занятие'}</button>}</Panel>;
    })}
    {tab === 'exercises' && <>
    <Panel><h3>Что значит запас повторений</h3><p>Это сколько повторений ты смог бы сделать ещё с правильной техникой после окончания подхода. Запас 3–4 — заканчивай, когда чувствуешь, что сможешь сделать ещё 3–4 повторения.</p><p className="muted">Например: сделал 10 повторений, но мог бы сделать всего 13–14. Значит, осталось 3–4 повторения в запасе. Проверять это дополнительными повторениями не нужно.</p></Panel>
    <Panel><h3>Как прибавлять</h3><p>Сначала добавляй повторы. Когда два занятия подряд все подходы на верхней границе с правильной техникой и запасом минимум в 2 повторения, прибавь минимальный вес и вернись к нижней границе. Если две тренировки подряд падают повторы или ноги тяжёлые дольше двух суток, снизь нагрузку или облегчи следующую тренировку. Вес гантели указан на одну руку.</p><p>Разминка перед силовой 5–8 мин и 1–3 пробных подхода. Отдых 2–3 мин в основных движениях, 90–120 сек в остальных, 30–60 сек на пресс.</p></Panel>
    </>}
    </div>}
    {deleting && <DeleteWorkoutDialog name={deleting.name} busy={busy} error={error} onConfirm={() => remove(deleting.day)} onCancel={() => {if (!busy) {setDeleting(null); setError('');}}} />}
  </>;
}
