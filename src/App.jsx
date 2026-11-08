import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {plannedWorkout, serializeWorkout, sessionWorkout, sessionDay, sessionName, currentPlan} from '../shared/plan.js';
import {createJournalStore} from './store.js';
import {localDateKey} from './journal.js';
import {Panel, Technique, Workout} from './components/Workout.jsx';
import {AppHeader} from './components/AppHeader.jsx';
import {ErrorNotice} from './components/ErrorNotice.jsx';
import {ConnectionLoader} from './components/ConnectionLoader.jsx';
import {Sidebar} from './components/Sidebar.jsx';
import {ExerciseLibrary} from './exercises/ExerciseLibrary.jsx';
import {Plan} from './pages/Plan.jsx';
import {Today} from './pages/Today.jsx';
import {Progress} from './pages/Progress.jsx';

const sections = [['today', 'Сегодня', '/today'], ['plan', 'План', '/plan'], ['exercises', 'Упражнения', '/exercises'], ['progress', 'Прогресс', '/progress']];

function WorkoutPage({journal, open, update, finish, showTechnique}) {
  const {sessionKey} = useParams();
  if (!journal.trainingV2?.sessions?.[sessionKey]) return <NotFound />;
  return <Workout key={sessionKey} journal={journal} sessionKey={sessionKey} update={update} finish={finish} showTechnique={showTechnique} />;
}

function ExercisesPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  return <ExerciseLibrary key={query} initialQuery={query} />;
}

function NotFound() {
  return <Panel><h2>Страница не найдена</h2><p>Проверь адрес или выбери раздел в меню.</p><Link to="/today">К ближайшей тренировке</Link></Panel>;
}

export function App({userId, onUnauthorized, onSignOut}) {
  const [store] = useState(() => createJournalStore({userId, onUnauthorized}));
  const {journal, status, ready: loaded, error: loadError} = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [technique, setTechnique] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    closeMenu();
    setTechnique(null);
    window.scrollTo(0, 0);
  }, [location.pathname, location.search, closeMenu]);
  const sessions = journal.trainingV2?.sessions ?? {};
  const isCatalog = location.pathname === '/exercises';
  const isPlan = location.pathname === '/plan';
  function open(dayOrKey, {todayOnly = false} = {}) {
    const currentJournal = store.getSnapshot().journal;
    const currentSessions = currentJournal.trainingV2?.sessions ?? {};
    if (typeof dayOrKey === 'string' && currentSessions[dayOrKey]) {navigate('/workouts/' + dayOrKey); return;}
    const day = dayOrKey;
    const schedule = currentPlan(currentJournal.trainingV2?.plan);
    if (!Number.isInteger(day) || day < 0 || !schedule.dayNames[day]) return;
    const ongoing = Object.entries(currentSessions).filter(([key, session]) => sessionDay(key, session) === day && session.status === 'Начата' && (!todayOnly || localDateKey(session.date) === localDateKey())).sort((a, b) => b[1].date.localeCompare(a[1].date));
    if (ongoing.length) {navigate('/workouts/' + ongoing[0][0]); return;}
    const items = plannedWorkout(currentJournal.trainingV2?.plan, day);
    if (!items.length) return;
    const key = crypto.randomUUID();
    store.update(j => {
      j.trainingV2.sessions[key] = {day, name: schedule.dayNames[day], status: 'Начата', date: new Date().toISOString(), sets: {}, plan: serializeWorkout(items)};
      setDayChoice(j, day);
    });
    navigate('/workouts/' + key);
  }
  function setDayChoice(journal, day) {
    const today = localDateKey();
    journal.trainingV2.dayChoices ??= {};
    journal.trainingV2.dayChoices[today] = day;
    const dates = Object.keys(journal.trainingV2.dayChoices).sort();
    for (const date of dates.slice(0, Math.max(0, dates.length - 365))) delete journal.trainingV2.dayChoices[date];
  }
  function chooseToday(day) {
    const schedule = currentPlan(store.getSnapshot().journal.trainingV2?.plan);
    if (!Number.isInteger(day) || !schedule.dayNames[day] || !schedule.days[day]?.length) throw Error('Это занятие больше недоступно. Выбери другое.');
    store.update(j => setDayChoice(j, day));
  }
  async function savePlan(plan) {
    store.update(j => {
      for (const [key, session] of Object.entries(j.trainingV2.sessions)) {
        session.name ??= sessionName(key, session);
        if (!session.plan) {
          session.plan = serializeWorkout(sessionWorkout(j, key));
        }
      }
      j.trainingV2.plan = plan;
      if (new TextEncoder().encode(JSON.stringify({journal: j, userId, revision: 2147483647})).length > 500000) throw Error('План и журнал слишком большие. Сократи заметки в плане и попробуй снова.');
    });
    if (!await store.flush()) throw Error('План пока не сохранён в аккаунте. Проверь соединение и попробуй снова.');
  }
  async function signOut() {if (await store.flush()) await onSignOut();}
  const loading = loadError ? <Panel><ErrorNotice title="Журнал пока недоступен" message={loadError} onAction={store.retry} actionLabel="Попробовать снова" /></Panel> : <div className="connection-loader-shell"><ConnectionLoader label="Загрузка журнала…" /></div>;
  return <div className="app-layout">
    <Sidebar items={sections} onSignOut={signOut} open={menuOpen} onClose={closeMenu} />
    <div className="app-content">
      <AppHeader status={status} onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <main className={isCatalog ? 'catalog-main' : isPlan ? 'plan-main' : undefined}>
        {loaded && <ErrorNotice title="Проблема с синхронизацией" message={loadError} onAction={store.retry} />}
        <div id="screen"><Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={loaded ? <Today journal={journal} sessions={sessions} open={value => open(value, {todayOnly:true})} onChoose={chooseToday} /> : loading} />
          <Route path="/plan" element={loaded ? <Plan sessions={sessions} open={open} plan={journal.trainingV2?.plan} onSave={savePlan} /> : loading} />
          <Route path="/progress" element={loaded ? <Progress sessions={sessions} plan={journal.trainingV2?.plan} /> : loading} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/workouts/:sessionKey" element={loaded ? <WorkoutPage journal={journal} open={open} update={store.update} finish={() => navigate('/today', {replace: true})} showTechnique={setTechnique} /> : loading} />
          <Route path="*" element={<NotFound />} />
        </Routes></div>
      </main>
    </div>
    {technique && <Technique exercise={technique} close={() => setTechnique(null)} browse={() => navigate('/exercises' + (technique.query ? '?q=' + encodeURIComponent(technique.query) : ''))} />}
  </div>;
}
