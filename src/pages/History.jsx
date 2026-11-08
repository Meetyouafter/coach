import {useRef, useState} from 'react';
import {EX, names} from '../../shared/program.js';
import {sessionName} from '../../shared/plan.js';
import {validate} from '../../shared/validate.js';
import {dateLabel, lastExerciseResults, pace, sessionResults, describeResult} from '../journal.js';
import {Panel} from '../components/Workout.jsx';
import {ErrorNotice} from '../components/ErrorNotice.jsx';

function Legacy({journal}) {
  const ids = [['bench','leg','rdl','row','calf','run','side'], ['press','chestrow','lateral','run','bug'], ['lunge','bridge','incline','lat','seated','ham','run','pallof'], ['run','crunch']];
  const weeks = Object.keys(journal).filter(k => /^\d+$/.test(k));
  if (!weeks.length) return null;
  return <Panel><h3>Записи из прежней версии</h3>{weeks.flatMap(week => Object.entries(journal[week]).map(([day, records]) => {
    const actual = Object.entries(records).filter(([i, r]) => i === 'note' ? !!r : r.done || r.a || r.b || r.c);
    if (!actual.length) return null;
    return <details key={week + '-' + day}><summary>Неделя {week} · {names[day]}</summary>{actual.map(([i, r]) => <p key={i}>{i === 'note' ? r : (EX[ids[day][i]]?.[0] ?? 'Бег') + ' · ' + [r.done ? 'выполнено' : '', r.a, r.b, r.c].filter(Boolean).join(' · ')}</p>)}</details>;
  }))}</Panel>;
}
export function History({journal, open, update, initialExpanded}) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(initialExpanded);
  const [error, setError] = useState('');
  const file = useRef(null);
  const sessions = journal.trainingV2?.sessions ?? {};
  const rows = filter ? lastExerciseResults(journal, filter, '') : [];
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, journal}, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'zal-beg-journal.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function upload(event) {
    const target = event.target, selected = target.files[0];
    if (!selected) return;
    try {
      if (selected.size > 500000) throw Error();
      const incoming = validate(JSON.parse(await selected.text()));
      const add = incoming.trainingV2?.sessions ?? {};
      const replace = Object.keys(add).filter(k => sessions[k]).length;
      const weeks = Object.keys(incoming).filter(k => /^\d+$/.test(k));
      const oldReplace = weeks.filter(k => journal[k]).length;
      if (!confirm(`Будет добавлено занятий: ${Object.keys(add).length - replace}, заменено: ${replace}. Старые недели: ${weeks.length - oldReplace} добавятся, ${oldReplace} заменятся. Продолжить?`)) return;
      update(j => {for (const w of weeks) j[w] = incoming[w]; Object.assign(j.trainingV2.sessions, add);});
      setError('');
    } catch {setError('Не удалось прочитать резервную копию.');}
    finally {target.value = '';}
  }
  return <><Panel><h2>История</h2><select aria-label="Упражнение в истории" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Выбрать упражнение</option>{Object.entries(EX).map(([id, e]) => <option key={id} value={id}>{e[0]}</option>)}</select></Panel>
    {filter && <Panel>{rows.length ? rows.map((r, i) => <p key={i}>{r.date ? dateLabel(r.date) : r.k} · {describeResult(r)}</p>) : <p>Записей пока нет</p>}</Panel>}
    {!Object.keys(sessions).length && <Panel><p>Занятий пока нет. Начни тренировку в разделе «Сегодня» или открой план.</p></Panel>}
    {Object.entries(sessions).sort((a, b) => b[1].date.localeCompare(a[1].date)).map(([key, s]) => {const name = sessionName(key, s); return <Panel key={key}><h3>{name}</h3><p>{dateLabel(s.date)} · {s.status}</p>{s.run && <p className="run">{s.run.km} км · {s.run.time} · {pace(s.run.km, s.run.sec)} · усилие {s.run.effort}/10{s.run.pulse ? ' · пульс ' + s.run.pulse : ''}</p>}
      {expanded === key && sessionResults(s).map(result => <p key={'result-' + result.id}>{EX[result.id]?.[0] ?? result.id} · {describeResult(result)}</p>)}
      <button onClick={() => setExpanded(expanded === key ? '' : key)}>{expanded === key ? 'Свернуть' : 'Подходы'}</button><button onClick={() => open(key)}>Открыть занятие</button></Panel>;})}
    <Legacy journal={journal} /><Panel><button onClick={download}>Экспорт JSON</button><button onClick={() => file.current.click()}>Импорт JSON</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={upload} /><ErrorNotice title="Не удалось импортировать журнал" message={error} /></Panel>
  </>;
}
