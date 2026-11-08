import {useEffect, useState} from 'react';
import {ArrowDown, ArrowUp, Plus, Trash2} from 'lucide-react';
import {EX, names} from '../../shared/program.js';
import {emptyPlan, weekPlan} from '../../shared/plan.js';
import {validatePlan} from '../../shared/validate.js';
import {Panel} from './Workout.jsx';
import {ErrorNotice} from './ErrorNotice.jsx';

export function PlanEditor({plan, week, tab, blank, onSave, onCancel}) {
  const [draft, setDraft] = useState(() => blank ? emptyPlan() : structuredClone(plan ?? {name: 'Мой план', weeks: {}}));
  const [additions, setAdditions] = useState({});
  const [copyTo, setCopyTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(blank);
  const current = weekPlan(draft, week);
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
  function editWeek(change) {
    edit(next => {next.weeks[week] ??= weekPlan(next, week); change(next.weeks[week]);});
  }
  function editItem(day, index, field, value) {editWeek(valueWeek => {valueWeek.days[day][index][field] = value;});}
  function move(day, index, offset) {
    editWeek(value => {const items = value.days[day]; [items[index], items[index + offset]] = [items[index + offset], items[index]];});
  }
  function add(day) {
    const id = additions[day];
    if (!id) return;
    const exercise = EX[id];
    editWeek(value => value.days[day].push({id, n: 2, reps: String(exercise[5]), weight: exercise[1], rir: '3–4', rest: 90, tip: exercise[2]}));
    setAdditions(previous => ({...previous, [day]: ''}));
  }
  async function save(event) {
    event.preventDefault(); setError('');
    try {
      if (Object.values(draft.weeks).some(value => value.kmMin > value.kmMax)) throw Error('Верхняя граница километража должна быть не меньше нижней.');
      try {validatePlan(draft);} catch {throw Error('Проверь заполнение плана: название, подходы, повторы и километраж во всех изменённых неделях.');}
      setBusy(true);
      await onSave(draft);
      setDirty(false);
    } catch (e) {setError(e.message || 'Не удалось сохранить план. Попробуй ещё раз.');}
    finally {setBusy(false);}
  }
  const numeric = event => event.target.value === '' ? '' : Number(event.target.value);

  return <div id={'plan-panel-' + tab} role="tabpanel" aria-labelledby={'plan-tab-' + tab}><form onSubmit={save} className="plan-editor" aria-label="Редактор плана" aria-busy={busy}>
    <fieldset disabled={busy} className="plan-editor-fieldset">
    <Panel><h3>{blank ? 'Новый план' : 'Редактирование плана'}</h3><p className="muted">12 недель · понедельник, среда, пятница и воскресенье. Пустой день — отдых. Изменения применятся к ещё не начатым занятиям.</p>
      <label className="plan-editor-label">Название плана<input required maxLength={100} value={draft.name} onChange={event => edit(next => {next.name = event.target.value;})} /></label>
      <label className="plan-editor-label">Заметка к неделе {week}<textarea rows={2} maxLength={1000} value={current.note} onChange={event => editWeek(value => {value.note = event.target.value;})} /></label>
      <div className="plan-copy"><label>Скопировать неделю {week} в<select value={copyTo} onChange={event => setCopyTo(event.target.value)}><option value="">Выбрать неделю</option>{Array.from({length: 12}, (_, index) => index + 1).filter(value => value !== week).map(value => <option key={value} value={value}>Неделя {value}</option>)}</select></label><button type="button" disabled={!copyTo} onClick={() => {edit(next => {next.weeks[copyTo] = structuredClone(current);}); setCopyTo('');}}>Копировать</button></div>
      {tab === 'run' && <><div className="plan-editor-grid"><label>Бег за неделю, от (км)<input type="number" min="0" max="800" step="0.1" required value={current.kmMin} onChange={event => editWeek(value => {value.kmMin = numeric(event);})} /></label><label>До (км)<input type="number" min="0" max="800" step="0.1" required value={current.kmMax} onChange={event => editWeek(value => {value.kmMax = numeric(event);})} /></label></div><p className="muted">Укажи недельный ориентир вручную — он будет показан на графике рядом с фактической дистанцией.</p></>}
    </Panel>
    {names.map((name, day) => {
      const items = current.days[day];
      const visible = items.map((item, index) => ({item, index})).filter(({item}) => tab === 'run' ? item.id === 'run' : item.id !== 'run');
      const available = Object.entries(EX).filter(([id]) => !items.some(item => item.id === id));
      return <Panel key={day}><h3>{name} · неделя {week}</h3>
        {!visible.length && <p className="muted">{tab === 'run' ? 'Бег не запланирован.' : 'Силовых упражнений нет.'}</p>}
        {visible.map(({item, index}) => <div className="plan-editor-item" key={item.id}>
          <div className="plan-editor-item-heading"><strong>{item.id === 'run' ? 'Бег' : EX[item.id][0]}</strong><div className="plan-editor-item-actions"><button type="button" disabled={index === 0} onClick={() => move(day, index, -1)} aria-label={'Выше: ' + (EX[item.id]?.[0] ?? 'Бег')}><ArrowUp size={17} aria-hidden="true" /></button><button type="button" disabled={index === items.length - 1} onClick={() => move(day, index, 1)} aria-label={'Ниже: ' + (EX[item.id]?.[0] ?? 'Бег')}><ArrowDown size={17} aria-hidden="true" /></button><button type="button" onClick={() => editWeek(value => {value.days[day].splice(index, 1);})} aria-label={'Убрать: ' + (EX[item.id]?.[0] ?? 'Бег')}><Trash2 size={17} aria-hidden="true" /></button></div></div>
          {item.id === 'run' ? <label className="plan-editor-label">Беговое задание<input required maxLength={500} placeholder="Например, 5 км легко" value={item.target} onChange={event => editItem(day, index, 'target', event.target.value)} /></label> : <div className="plan-editor-grid">
            <label>Подходы<input type="number" min="1" max="20" required value={item.n} onChange={event => editItem(day, index, 'n', numeric(event))} /></label>
            <label>Повторы или секунды<input required maxLength={80} placeholder="8–12 или 30 сек." value={item.reps} onChange={event => editItem(day, index, 'reps', event.target.value)} /></label>
            <label>Стартовый вес<input maxLength={120} placeholder="Например, по 4 кг" value={item.weight} onChange={event => editItem(day, index, 'weight', event.target.value)} /></label>
            <label>Повторения в запасе<input maxLength={30} placeholder="Например, 3–4" value={item.rir} onChange={event => editItem(day, index, 'rir', event.target.value)} /></label>
            <label>Отдых, секунд<input type="number" min="0" max="1800" required value={item.rest} onChange={event => editItem(day, index, 'rest', numeric(event))} /></label>
          </div>}
          <label className="plan-editor-label">{item.id === 'run' ? 'Как бежать' : 'Техника и заметки'}<textarea rows={2} maxLength={3000} value={item.tip} onChange={event => editItem(day, index, 'tip', event.target.value)} /></label>
        </div>)}
        {tab === 'run' ? !items.some(item => item.id === 'run') && <button type="button" onClick={() => editWeek(value => value.days[day].push({id: 'run', target: '5 км легко', tip: '', test: false}))}><Plus size={16} aria-hidden="true" /> Добавить бег</button> : available.length > 0 && <div className="plan-add"><label className="sr-only" htmlFor={'plan-add-' + day}>Добавить упражнение: {name}</label><select id={'plan-add-' + day} value={additions[day] ?? ''} onChange={event => setAdditions(previous => ({...previous, [day]: event.target.value}))}><option value="">Выбрать упражнение</option>{available.map(([id, exercise]) => <option key={id} value={id}>{exercise[0]}</option>)}</select><button type="button" disabled={!available.some(([id]) => id === additions[day])} onClick={() => add(day)}><Plus size={17} aria-hidden="true" /> Добавить</button></div>}
      </Panel>;
    })}
    <div className="plan-editor-save"><ErrorNotice title="План не сохранён" message={error} /><p className="muted" role="status">{dirty ? 'Есть несохранённые изменения.' : 'Измени план и нажми «Сохранить план».'}</p><div className="row"><button type="submit" className="primary">{busy ? 'Сохраняем…' : 'Сохранить план'}</button><button type="button" onClick={onCancel}>Отменить изменения</button></div></div>
    </fieldset>
  </form></div>;
}
