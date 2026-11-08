import {useEffect, useRef, useState} from 'react';
import {App} from './App.jsx';
import {AppHeader} from './components/AppHeader.jsx';

const accountKey = 'coach-active-user';
export function AuthGate() {
  const generation = useRef(0);
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
  const [action, setAction] = useState('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function broadcast() {
    try {localStorage.setItem(accountKey, String(Date.now()) + Math.random());} catch { /* The API also checks account changes. */ }
  }
  function acceptSession(result) {
    setUser(result.authenticated ? result.user : null);
    setState(result.authenticated ? 'ready' : 'login');
  }
  async function check() {
    const current = ++generation.current;
    setState('loading'); setError('');
    try {
      const response = await fetch('/api/session', {cache:'no-store'});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось проверить вход.');
      if (current === generation.current) acceptSession(result);
    } catch (e) {if (current === generation.current) {setError(e.message === 'Failed to fetch' ? 'Нет связи с сервером. Повтори после восстановления сети.' : e.message); setState('error');}}
  }
  useEffect(() => {
    // The journal no longer uses browser storage; remove caches from older versions.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key === 'zal-beg-cloud-v2' || key.startsWith('coach-journal-v3:') || key.startsWith('coach-local-journal-v1:')) localStorage.removeItem(key);
      }
    } catch { /* Browser storage is optional for account-change notifications and themes. */ }
    void check();
    const changed = event => {if (event.key === accountKey || event.key === null) void check();};
    window.addEventListener('storage',changed);
    return () => window.removeEventListener('storage',changed);
  },[]);
  function requireLogin() {++generation.current; setUser(null); setState('login'); setError('Войди в аккаунт повторно.');}
  async function submitAccount(event) {
    event.preventDefault(); const current = ++generation.current; setBusy(true); setError('');
    try {
      const response = await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,login,password})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось войти.');
      if (current !== generation.current) return;
      setPassword(''); acceptSession(result); broadcast();
    } catch (e) {if (current === generation.current) setError(e.message === 'Failed to fetch' ? 'Нет связи с сервером.' : e.message);}
    finally {setBusy(false);}
  }
  async function logout() {
    ++generation.current;
    try {
      const response = await fetch('/api/session',{method:'DELETE'});
      if (!response.ok) throw Error();
      setError(''); setUser(null); setState('login'); broadcast();
    } catch {setError('Не удалось выйти. Проверь соединение и повтори.');}
  }
  if (state === 'ready') return <><App key={user.id} userId={user.id} onUnauthorized={requireLogin} onSignOut={logout} />{error && <p className="auth-error" role="alert">{error}</p>}</>;
  return <div className="auth-layout"><AppHeader /><main className="auth-main"><section className="panel auth-card">
    {state === 'loading' ? <p role="status">Подключение…</p> : state === 'error' ? <><p className="error" role="alert">{error}</p><button onClick={check}>Повторить</button></> : <>
      <h2>{action==='register'?'Создать аккаунт':'Вход в аккаунт'}</h2>
      <p className="muted">Тренировки сохраняются в твоём аккаунте и доступны на любом устройстве.</p>
      <div className="auth-tabs" role="group" aria-label="Вход или регистрация"><button type="button" aria-pressed={action==='login'} onClick={()=>{setAction('login');setError('');}}>Войти</button><button type="button" aria-pressed={action==='register'} onClick={()=>{setAction('register');setError('');}}>Регистрация</button></div>
      <form onSubmit={submitAccount}>
        <label>Логин<input name="username" autoComplete="username" required minLength={3} maxLength={40} value={login} onChange={event=>setLogin(event.target.value)} /></label>
        <label>Пароль · от 16 символов<input type="password" autoComplete={action==='register'?'new-password':'current-password'} required minLength={16} maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)} /></label>
        <p className="error" role="alert">{error}</p><button className="primary" disabled={busy}>{busy?'Подключение…':action==='register'?'Зарегистрироваться':'Войти'}</button>
      </form><p className="muted auth-note">Сохрани логин и пароль. Восстановление пароля пока недоступно.</p>
    </>}
  </section></main></div>;
}
