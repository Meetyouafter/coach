import {useEffect, useRef, useState} from 'react';
import {Navigate, useLocation, useNavigate} from 'react-router-dom';
import {App} from './App.jsx';
import {AppHeader} from './components/AppHeader.jsx';
import {AuthField} from './components/AuthField.jsx';
import {ErrorNotice} from './components/ErrorNotice.jsx';
import {validateAccount} from '../shared/account-validation.js';

const accountKey = 'coach-active-user';
async function sessionRequest(init) {
  let response;
  try {response = await fetch('/api/session', init);}
  catch {throw Error('Проверь подключение к интернету и попробуй ещё раз.');}
  let result;
  try {result = await response.json();}
  catch {throw Error('Сервер не ответил как ожидалось. Попробуй ещё раз через несколько секунд.');}
  return {response,result};
}
export function AuthGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const generation = useRef(0);
  const form = useRef(null);
  const [state, setState] = useState('loading');
  const [user, setUser] = useState(null);
  const action = location.pathname === '/register' ? 'register' : 'login';
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const returnTo = location.state?.from;
  const destination = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') && !['/login', '/register'].includes(returnTo.split('?')[0]) ? returnTo : '/today';
  const [values, setValues] = useState({login:'',password:'',confirmPassword:''});
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValues(old => ({...old, confirmPassword: ''}));
    setTouched({}); setServerErrors({});
  }, [action]);
  const issues = validateAccount(values,action);
  const fieldErrors = {...Object.fromEntries(Object.entries(issues).filter(([name]) => touched[name])),...serverErrors};
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
      const {response,result} = await sessionRequest({cache:'no-store'});
      if (!response.ok) throw Error(result.error || 'Попробуй подключиться ещё раз.');
      if (current === generation.current) acceptSession(result);
    } catch (e) {if (current === generation.current) {setError(e.message); setState('error');}}
  }
  useEffect(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key === 'zal-beg-cloud-v2' || key.startsWith('coach-journal-v3:') || key.startsWith('coach-local-journal-v1:')) localStorage.removeItem(key);
      }
    } catch { /* Only themes and account-change signals use browser storage. */ }
    void check();
    const changed = event => {if (event.key === accountKey || event.key === null) void check();};
    window.addEventListener('storage',changed);
    return () => window.removeEventListener('storage',changed);
  },[]);
  function requireLogin() {++generation.current; setUser(null); setState('login'); setError('Сессия завершилась. Введи логин и пароль, чтобы продолжить.');}
  function edit(name,value) {
    setValues(old=>({...old,[name]:value})); setServerErrors({}); setError('');
  }
  function selectAction(next) {
    navigate('/' + next, {state: location.state}); setValues(old=>({...old,confirmPassword:''})); setTouched({}); setServerErrors({}); setError('');
  }
  function focusFirst(errors) {
    const name = ['login','password','confirmPassword'].find(name=>errors[name]);
    requestAnimationFrame(()=>form.current?.elements.namedItem(name)?.focus());
  }
  async function submitAccount(event) {
    event.preventDefault(); setError(''); setServerErrors({});
    setTouched({login:true,password:true,confirmPassword:action==='register'});
    const errors = validateAccount(values,action);
    if (Object.keys(errors).length) {focusFirst(errors); return;}
    const current = ++generation.current; setBusy(true);
    try {
      const {response,result} = await sessionRequest({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,login:values.login,password:values.password,...(action==='register'?{confirmPassword:values.confirmPassword}:{})})});
      if (current !== generation.current) return;
      if (!response.ok) {
        if (result.fieldErrors && Object.keys(result.fieldErrors).length) {setServerErrors(result.fieldErrors);focusFirst(result.fieldErrors);return;}
        throw Error(result.error || 'Попробуй ещё раз через несколько секунд.');
      }
      setValues(old=>({...old,password:'',confirmPassword:''})); setTouched({}); acceptSession(result); broadcast();
    } catch (e) {if (current === generation.current) setError(e.message);}
    finally {setBusy(false);}
  }
  async function logout() {
    ++generation.current;
    try {
      const response = await fetch('/api/session',{method:'DELETE'});
      if (!response.ok) throw Error();
      setError(''); setUser(null); setState('login'); broadcast(); navigate('/login', {replace: true});
    } catch {setError('Проверь соединение и попробуй выйти ещё раз.');}
  }
  const fieldProps = name => ({name,value:values[name],error:fieldErrors[name],onChange:event=>edit(name,event.target.value),onBlur:()=>setTouched(old=>({...old,[name]:true})),disabled:busy});
  if (state === 'ready') {
    if (isAuthPage) return <Navigate to={destination} replace />;
    return <><App key={user.id} userId={user.id} onUnauthorized={requireLogin} onSignOut={logout} />{error && <div className="auth-error"><ErrorNotice title="Не удалось выйти" message={error} onAction={logout} /></div>}</>;
  }
  if (state === 'login' && !isAuthPage) return <Navigate to="/login" replace state={{from: location.pathname + location.search + location.hash}} />;
  return <div className="auth-layout"><AppHeader /><main className="auth-main"><section className="panel auth-card">
    {state === 'loading' ? <p role="status">Подключение…</p> : state === 'error' ? <ErrorNotice title="Не удалось подключиться" message={error} onAction={check} actionLabel="Попробовать снова" /> : <>
      <h2>{action==='register'?'Создать аккаунт':'Вход в аккаунт'}</h2>
      <p className="muted">Тренировки сохраняются в твоём аккаунте и доступны на любом устройстве.</p>
      <div className="auth-tabs" role="group" aria-label="Вход или регистрация"><button type="button" disabled={busy} aria-pressed={action==='login'} onClick={()=>selectAction('login')}>Войти</button><button type="button" disabled={busy} aria-pressed={action==='register'} onClick={()=>selectAction('register')}>Регистрация</button></div>
      <form ref={form} noValidate onSubmit={submitAccount} aria-busy={busy}>
        <AuthField {...fieldProps('login')} label="Логин" autoComplete="username" required minLength={3} maxLength={40} hint={action==='register'?'От 3 символов: буквы, цифры, _ . -':undefined} />
        <AuthField {...fieldProps('password')} label="Пароль" type="password" autoComplete={action==='register'?'new-password':'current-password'} required minLength={action==='register'?12:undefined} maxLength={1024} hint={action==='register'?'Не менее 12 символов.':undefined} />
        {action==='register' && <AuthField {...fieldProps('confirmPassword')} label="Повтори пароль" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} />}
        <ErrorNotice title={action==='register'?'Не удалось создать аккаунт':'Не удалось войти'} message={error} />
        <button className="primary" disabled={busy}>{busy?'Подключение…':action==='register'?'Зарегистрироваться':'Войти'}</button>
      </form><p className="muted auth-note">Сохрани логин и пароль. Восстановление пароля пока недоступно.</p>
    </>}
  </section></main></div>;
}
