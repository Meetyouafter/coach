import {useId, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, ChevronLeft, ChevronRight} from 'lucide-react';
import {currentPlan, sessionName} from '../../shared/plan.js';
import {dateLabel, pace} from '../journal.js';
import {Panel} from './Workout.jsx';

const format = value => value.toLocaleString('ru-RU', {maximumFractionDigits: 1});
const minutes = seconds => `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, '0')}`;
const periods = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']];
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shortDate = date => date.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'});
function periodStart(value, period) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (period === 'month') date.setDate(1);
  return date;
}
function shiftPeriod(value, period, count) {
  const date = new Date(value);
  if (period === 'month') date.setMonth(date.getMonth() + count);
  else date.setDate(date.getDate() + count * (period === 'week' ? 7 : 1));
  return date;
}
const duration = seconds => `${Math.floor(seconds / 3600)} ч ${Math.floor(seconds % 3600 / 60)} мин`;

export function RunningProgress({sessions, plan}) {
  const gradient = useId();
  const [metric, setMetric] = useState('km');
  const [period, setPeriod] = useState('week');
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState(null);
  const schedule = currentPlan(plan);
  const hasPlannedRunning = schedule.days.some(items => items.some(exercise => exercise.id === 'run'));
  const hasRunning = Object.values(sessions).some(session => session.run) || hasPlannedRunning;
  if (!hasRunning) return <Panel><h3>Бег не запланирован</h3><p className="muted">Добавь пробежки в план — здесь появятся беговые графики.</p><Link to="/plan?tab=run">Добавить бег в план →</Link></Panel>;
  const allRuns = Object.entries(sessions).filter(([, session]) => session.run).sort((a, b) => a[1].date.localeCompare(b[1].date));
  const count = period === 'day' ? 14 : 12;
  const anchor = periodStart(allRuns.at(-1)?.[1].date ?? new Date(), period);
  const end = shiftPeriod(anchor, period, page * count + 1);
  const start = shiftPeriod(end, period, -count);
  const calendar = Array.from({length: count}, (_, index) => {
    const from = shiftPeriod(start, period, index);
    const to = shiftPeriod(from, period, 1);
    const runs = allRuns.filter(([, session]) => {
      const date = new Date(session.date);
      return date >= from && date < to;
    });
    const km = runs.reduce((sum, [, session]) => sum + session.run.km, 0);
    const sec = runs.reduce((sum, [, session]) => sum + session.run.sec, 0);
    const last = new Date(to);
    last.setDate(last.getDate() - 1);
    const label = period === 'month' ? from.toLocaleDateString('ru-RU', {month: 'long', year: 'numeric'}) : period === 'week' ? `${shortDate(from)} – ${shortDate(last)}, ${last.getFullYear()}` : dateLabel(from);
    const tick = period === 'month' ? from.toLocaleDateString('ru-RU', {month: 'short'}) : from.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'});
    return {id: dateKey(from), label, tick, runs, km, sec, pace: km ? sec / km : null, minutes: runs.length ? sec / 60 : null};
  });
  const buckets = calendar;
  const defaultIndex = buckets.findLastIndex(bucket => bucket.runs.length);
  const selectedIndex = buckets.findIndex(bucket => bucket.id === selection);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : defaultIndex >= 0 ? defaultIndex : buckets.length - 1;
  const active = buckets[activeIndex];
  const showPlan = period === 'week' && metric === 'km' && hasPlannedRunning && schedule.kmMax > 0;
  const values = buckets.map(bucket => bucket.runs.length ? (metric === 'km' ? bucket.km : bucket[metric]) : null);
  const observed = values.filter(value => value !== null);
  const upper = metric === 'km' ? Math.max(5, ...observed, ...(showPlan ? [schedule.kmMax] : [])) * 1.12 : metric === 'pace' ? Math.max(60, ...observed) * 1.12 : Math.max(10, ...observed) * 1.12;
  const lower = metric === 'pace' && observed.length ? Math.max(0, Math.min(...observed) * .8) : 0;
  const left = 52, right = 660, top = 22, bottom = 222;
  const x = index => left + index / (buckets.length - 1) * (right - left);
  const y = value => metric === 'pace' ? top + (value - lower) / (upper - lower) * (bottom - top) : bottom - value / upper * (bottom - top);
  let connected = false;
  const actualPath = values.map((value, index) => {
    if (value === null) {connected = false; return '';}
    const command = connected ? 'L' : 'M';
    connected = true;
    return `${command}${x(index)},${y(value)}`;
  }).join(' ');
  let areaStart = null;
  const areaPath = values.map((value, index) => {
    if (value === null) return '';
    const start = areaStart === null;
    if (start) areaStart = index;
    let segment = start ? `M${x(index)},${bottom} L${x(index)},${y(value)}` : `L${x(index)},${y(value)}`;
    if (values[index + 1] == null) {
      segment += ` L${x(index)},${bottom} L${x(areaStart)},${bottom} Z`;
      areaStart = null;
    }
    return segment;
  }).join(' ');
  const planBand = `M${left},${y(schedule.kmMax)} L${right},${y(schedule.kmMax)} L${right},${y(schedule.kmMin)} L${left},${y(schedule.kmMin)} Z`;
  const selectedValue = values[activeIndex];
  const unit = metric === 'km' ? 'км' : metric === 'pace' ? 'мин/км' : 'мин';
  const axisLabel = value => metric === 'pace' ? minutes(value) : format(value);
  function selectWithKeyboard(event, index) {
    if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'ArrowRight' ? Math.min(buckets.length - 1, index + 1) : index;
      setSelection(buckets[next].id);
      event.currentTarget.parentElement.querySelector(`[data-index="${next}"]`)?.focus();
    }
  }
  function changePeriod(value) {setPeriod(value); setPage(0); setSelection(null);}
  function changePage(offset) {setPage(value => value + offset); setSelection(null);}
  const rangeEnd = new Date(end);
  rangeEnd.setDate(rangeEnd.getDate() - 1);


  return <Panel className="running-progress">
    <div className="progress-section-heading"><div><p className="running-eyebrow">БЕГ / ТВОЙ ТЕМП</p><h3>Твой беговой прогресс <ArrowUpRight size={21} aria-hidden="true" /></h3><p className="muted">Дистанция, время и темп сохранённых пробежек.</p></div></div>
    <div className="progress-switch running-switch" role="group" aria-label="Показатель бегового графика">{[['km', 'Дистанция'], ['pace', 'Темп'], ['minutes', 'Время']].map(([id, label]) => <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>)}</div>
    <div className="running-period-controls"><div className="progress-switch running-period-switch" role="group" aria-label="Период бегового графика">{periods.map(([id, label]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => changePeriod(id)}>{label}</button>)}</div><div className="running-range-controls"><button type="button" aria-label="Предыдущий период" onClick={() => changePage(-1)}><ChevronLeft size={18} aria-hidden="true" /></button><span>{shortDate(start)} {start.getFullYear()} – {shortDate(rangeEnd)} {rangeEnd.getFullYear()}</span><button type="button" aria-label="Следующий период" disabled={page >= 0} onClick={() => changePage(1)}><ChevronRight size={18} aria-hidden="true" /></button></div></div>
    <div className="running-summary" aria-live="polite"><div><span className="muted">{active.label}</span><strong>{selectedValue === null ? '—' : metric === 'pace' ? minutes(selectedValue) : format(selectedValue)} <small>{unit}</small></strong></div><div className="running-summary-plan">{showPlan ? <><span className="muted">Ориентир по плану</span><strong>≈ {schedule.kmMin === schedule.kmMax ? schedule.kmMin : schedule.kmMin + '–' + schedule.kmMax} км</strong></> : <><span className="muted">Пробежки за период</span><strong>{active.runs.length}</strong></>}</div></div>
    <div className="running-chart-scroll"><svg className="running-chart" style={{minWidth: buckets.length * 44 + 80}} viewBox="0 0 690 265" role="group" aria-label={`Бег: ${unit}. Выбери период для подробностей.`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".17" /><stop offset="100%" stopColor="currentColor" stopOpacity=".02" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(tick => {
        const value = metric === 'pace' ? lower + tick / 4 * (upper - lower) : upper * (1 - tick / 4);
        const position = top + tick / 4 * (bottom - top);
        return <g key={tick} className="running-grid"><line x1={left} x2={right} y1={position} y2={position} /><text x={left - 10} y={position + 4} textAnchor="end">{axisLabel(value)}</text></g>;
      })}
      {showPlan && <><path d={planBand} className="running-plan-band" /><path d={`M${left},${y((schedule.kmMin + schedule.kmMax) / 2)} L${right},${y((schedule.kmMin + schedule.kmMax) / 2)}`} className="running-plan-line" /></>}
      <path d={areaPath} fill={`url(#${gradient})`} />
      <path d={actualPath} className="running-actual-line" />
      <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} className="running-cursor" />
      {values.map((value, index) => value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={activeIndex === index ? 6 : 4} className="running-point" />)}
      {buckets.map((bucket, index) => <g key={bucket.id} role="button" tabIndex={0} data-index={index} aria-pressed={activeIndex === index} aria-label={`${bucket.label}: ${values[index] === null ? 'нет записей' : `${axisLabel(values[index])} ${unit}`}`} onPointerEnter={() => setSelection(bucket.id)} onClick={() => setSelection(bucket.id)} onFocus={() => setSelection(bucket.id)} onKeyDown={event => selectWithKeyboard(event, index)} className="running-hit"><rect x={x(index) - Math.min(24, (right - left) / (buckets.length - 1) / 2)} y={top - 8} width={Math.min(48, (right - left) / (buckets.length - 1))} height={bottom - top + 40} fill="transparent" /><text x={x(index)} y={bottom + 25} textAnchor="middle">{bucket.tick}</text></g>)}
    </svg></div>
    <div className="running-legend"><span><i />Факт</span>{showPlan && <span><i className="running-legend-plan" />Текущий ориентир</span>}<span className="muted">{period === 'day' ? 'Дни' : period === 'week' ? 'Недели с понедельника' : 'Месяцы'} →</span></div>
    <p className="muted progress-chart-note">{metric === 'pace' ? 'Средний темп = общее время ÷ дистанция за выбранный период. Чем выше точка, тем быстрее бег. Учитывай, что лёгкие и интервальные тренировки различаются.' : metric === 'km' ? (showPlan ? 'Пунктир — текущий недельный ориентир из твоего плана, полоса — его диапазон. Факт включает весь сохранённый бег.' : 'Сумма дистанций сохранённых пробежек за период. Даты берутся из записей занятий.') : 'Общее время всех сохранённых пробежек за выбранный период.'} Периоды без записей показаны без точек.</p>
    <div className="running-week-activities" aria-live="polite"><h4>Пробежки · {active.label}</h4>{!active.runs.length ? <p className="muted">Пока нет записей. Сохрани бег в тренировке — результат появится на графике.</p> : active.runs.map(([key, session]) => <Link key={key} to={'/workouts/' + key} className="running-activity"><div><strong>{sessionName(key, session)}</strong><span>{dateLabel(session.date)}</span></div><div><strong>{format(session.run.km)} км</strong><span>{duration(session.run.sec)}</span></div><div><strong>{pace(session.run.km, session.run.sec)}</strong><span>средний темп</span></div></Link>)}</div>
  </Panel>;
}
