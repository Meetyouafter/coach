import {useCallback, useEffect, useState, useSyncExternalStore} from 'react';
import {Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {names} from '../shared/program.js';
import {createJournalStore} from './store.js';
import {Panel, Technique, Workout} from './components/Workout.jsx';
import {AppHeader} from './components/AppHeader.jsx';
import {ErrorNotice} from './components/ErrorNotice.jsx';
import {Sidebar} from './components/Sidebar.jsx';
import {ExerciseLibrary} from './exercises/ExerciseLibrary.jsx';
import {Plan} from './pages/Plan.jsx';
import {Today} from './pages/Today.jsx';

const sections = [['today', 'Сегодня', '/today'], ['plan', 'План', '/plan'], ['exercises', 'Упражнения', '/exercises']];

function WorkoutPage({journal, open, update, finish, showTechnique}) {
  const {sessionKey} = useParams();
  const [week, day] = sessionKey.split('-').map(Number);
  if (!/^(?:[1-9]|1[0-2])-[0-3]$/.test(sessionKey)) return <NotFound />;
  if (!journal.trainingV2?.sessions?.[sessionKey]) return <Panel><h2>{names[day]} · неделя {week}</h2><button className="primary" onClick={() => open(sessionKey)}>Начать занятие</button></Panel>;
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
  function open(key) {
    if (!sessions[key]) store.update(j => {j.trainingV2.sessions[key] = {status: 'Начата', date: new Date().toISOString(), sets: {}};});
    navigate('/workouts/' + key);
  }
  async function signOut() {if (await store.flush()) await onSignOut();}
  const loading = <Panel>{loadError ? <ErrorNotice title="Журнал пока недоступен" message={loadError} onAction={store.retry} actionLabel="Попробовать снова" /> : <p className="boot">Загрузка журнала…</p>}</Panel>;
  return <div className="app-layout">
    <Sidebar items={sections} onSignOut={signOut} open={menuOpen} onClose={closeMenu} />
    <div className="app-content">
      <AppHeader status={status} onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <main className={isCatalog ? 'catalog-main' : undefined}>
        {loaded && <ErrorNotice title="Проблема с синхронизацией" message={loadError} onAction={store.retry} />}
        <div id="screen"><Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={loaded ? <Today sessions={sessions} open={open} /> : loading} />
          <Route path="/plan" element={loaded ? <Plan sessions={sessions} open={open} /> : loading} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/workouts/:sessionKey" element={loaded ? <WorkoutPage journal={journal} open={open} update={store.update} finish={() => navigate('/today', {replace: true})} showTechnique={setTechnique} /> : loading} />
          <Route path="*" element={<NotFound />} />
        </Routes></div>
      </main>
    </div>
    {technique && <Technique exercise={technique} close={() => setTechnique(null)} browse={() => navigate('/exercises' + (technique.query ? '?q=' + encodeURIComponent(technique.query) : ''))} />}
  </div>;
}
