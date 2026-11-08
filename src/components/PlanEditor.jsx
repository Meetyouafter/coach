import {useEffect, useState} from 'react';
import {currentPlan, weekdays} from '../../shared/plan.js';
import {validatePlan} from '../../shared/validate.js';
import {Panel} from './Workout.jsx';
import {ErrorNotice} from './ErrorNotice.jsx';
import {PlanBuilder} from './PlanBuilder.jsx';
import {SelectField} from './SelectField.jsx';

export function PlanEditor({plan, tab, day, isNew = false, initialWeekday = '', onSave, onCancel}) {
  const [draft, setDraft] = useState(() => {const next = currentPlan(plan); if (isNew) {next.days.push([]); next.dayNames.push(initialWeekday);} return next;});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(isNew);
  const current = draft;
  const occupiedDays = new Set(draft.dayNames.filter((name, index) => index !== day && weekdays.includes(name)));
  useEffect(() => {
    if (!dirty) return;
    const warn = event => {event.preventDefault(); event.returnValue = '';};
    const guardLink = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target === '_blank') return;
      const url = new URL(anchor.href);
      if ((url.origin !== location.origin || url.pathname !== location.pathname) && !window.confirm('В плане есть несохранённые изменения. Уйти со страницы?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => {window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true);};
  }, [dirty]);
  function edit(change) {
    setDraft(previous => {const next = structuredClone(previous); change(next); return next;});
    setDirty(true); setError('');
  }
  function editSchedule(change) {edit(change);}
  function editItem(day, index, field, value) {editSchedule(valueWeek => {valueWeek.days[day][index][field] = value;});}
  async function save(event) {
    event.preventDefault(); setError('');
    try {
      if (!weekdays.includes(draft.dayNames[day])) throw Error('Выбери день недели для занятия.');
      if (occupiedDays.has(draft.dayNames[day])) throw Error('На выбранный день уже есть занятие. Выбери другой день недели.');
      if (draft.kmMin > draft.kmMax) throw Error('Верхняя граница километража должна быть не меньше нижней.');
      try {validatePlan(draft);} catch (e) {throw Error(e.message || 'Проверь день недели, подходы, повторы и километраж.');}
      setBusy(true);
      await onSave(draft);
      setDirty(false);
    } catch (e) {setError(e.message || 'Не удалось сохранить занятие. Попробуй ещё раз.');}
    finally {setBusy(false);}
  }
  const numeric = event => event.target.value === '' ? '' : Number(event.target.value);

  return <div id={'plan-panel-' + tab} role="tabpanel" aria-labelledby={'plan-tab-' + tab}><form onSubmit={save} onInvalidCapture={event => {const details = event.target.closest('details'); if (details) details.open = true;}} className="plan-editor" aria-label="Редактор занятия" aria-busy={busy}>
    <fieldset disabled={busy} className="plan-editor-fieldset">
    <Panel><h3>{isNew ? 'Добавить занятие' : 'Редактировать занятие'}</h3><p className="muted">Выбери день недели и собери занятие из упражнений и бега. Изменения применятся к новым тренировкам.</p>
      <label className="plan-editor-label">День недели<SelectField required autoFocus value={weekdays.includes(draft.dayNames[day]) ? draft.dayNames[day] : ''} onChange={event => edit(next => {next.dayNames[day] = event.target.value;})}><option value="" disabled>Выбрать день недели</option>{weekdays.map(name => <option key={name} value={name} disabled={occupiedDays.has(name)}>{name}{occupiedDays.has(name) ? ' — уже есть занятие' : ''}</option>)}</SelectField></label>
      {tab !== 'exercises' && <><div className="plan-editor-grid"><label>Бег за неделю, от (км)<input type="number" min="0" max="800" step="0.1" required value={current.kmMin} onChange={event => editSchedule(value => {value.kmMin = numeric(event);})} /></label><label>До (км)<input type="number" min="0" max="800" step="0.1" required value={current.kmMax} onChange={event => editSchedule(value => {value.kmMax = numeric(event);})} /></label></div><p className="muted">Укажи недельный ориентир вручную — он будет показан на графике рядом с фактической дистанцией.</p></>}
    </Panel>
    <PlanBuilder plan={draft} selectedDay={day} tab={tab} disabled={busy} onChange={value => {setDraft(value); setDirty(true); setError('');}} onEdit={editItem} onRemove={(day, index) => editSchedule(value => {value.days[day].splice(index, 1);})} />
    <div className="plan-editor-save"><ErrorNotice title="Занятие не сохранено" message={error} /><p className="muted" role="status">{dirty ? 'Есть несохранённые изменения.' : 'Измени занятие и нажми «Сохранить занятие».'}</p><div className="row"><button type="submit" className="primary">{busy ? 'Сохраняем…' : 'Сохранить занятие'}</button><button type="button" onClick={onCancel}>Отменить изменения</button></div></div>
    </fieldset>
  </form></div>;
}
