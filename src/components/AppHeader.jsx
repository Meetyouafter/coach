import {ThemeControl} from './ThemeControl.jsx';
import {Dumbbell} from 'lucide-react';

export function AppHeader({status, onSignOut}) {
  return <header className="app-header"><div className="app-header-inner">
    <div className="app-brand"><div className="brand-heading"><span className="brand-icon" aria-hidden="true"><Dumbbell size={23} strokeWidth={1.8} /></span><div>{onSignOut && <p className="tag">12 недель · зал и бег</p>}<h1>Личный журнал тренировок</h1></div></div>{status && <p className="header-status muted" role="status">{status}</p>}</div>
    <div className="header-actions"><ThemeControl />{onSignOut && <button className="sign-out" onClick={onSignOut}>Выйти</button>}</div>
  </div></header>;
}
