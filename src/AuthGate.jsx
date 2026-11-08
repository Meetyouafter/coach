import {useEffect, useState} from 'react';
import {App} from './App.jsx';
import {AppHeader} from './components/AppHeader.jsx';

export function AuthGate() {
  const [state, setState] = useState('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setState('loading'); setError('');
    try {
      const response = await fetch('/api/session', {cache: 'no-store'});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось проверить вход.');
      setState(result.authenticated ? 'ready' : 'login');
    } catch (e) {setError(e.message === 'Failed to fetch' ? 'Нет связи с сервером. Повтори после восстановления сети.' : e.message); setState('error');}
  }
  useEffect(() => {void check();}, []);
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/session', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({password})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось войти.');
      setPassword(''); setState('ready');
    } catch (e) {setError(e.message === 'Failed to fetch' ? 'Нет связи с сервером.' : e.message);}
    finally {setBusy(false);}
  }
  async function logout() {
    try {
      const response = await fetch('/api/session', {method: 'DELETE'});
      if (!response.ok) throw Error();
      setError(''); setState('login');
    } catch {setError('Не удалось выйти. Проверь соединение и повтори.');}
  }
  if (state === 'ready') return <><App onUnauthorized={() => setState('login')} onSignOut={logout} />{error && <p className="auth-error" role="alert">{error}</p>}</>;
  return <div className="auth-layout"><AppHeader /><main className="auth-main"><section className="panel auth-card">
    {state === 'loading' ? <p role="status">Подключение…</p> : state === 'error' ? <><p className="error" role="alert">{error}</p><button onClick={check}>Повторить</button></> : <form onSubmit={login}><h2>Вход в журнал</h2><p className="muted">Введи свой пароль, чтобы открыть тренировки и синхронизацию.</p><label>Пароль<input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} /></label><p className="error" role="alert">{error}</p><button className="primary" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button></form>}
  </section></main></div>;
}
