import {ThemeControl} from './ThemeControl.jsx';
import {Dumbbell, Menu} from 'lucide-react';

export function AppHeader({status, onOpenMenu, menuOpen}) {
  return <header className="app-header"><div className="app-header-inner">
    {onOpenMenu && <button className="menu-toggle" type="button" onClick={onOpenMenu} aria-label="Открыть меню" aria-controls="mobile-sidebar" aria-expanded={menuOpen}><Menu size={22} aria-hidden="true" /></button>}
    <div className="app-brand"><div className="brand-heading"><span className="brand-icon" aria-hidden="true"><Dumbbell size={23} strokeWidth={1.8} /></span><div>{onOpenMenu && <p className="tag">12 недель · зал и бег</p>}<h1>Личный журнал тренировок</h1></div></div>{status && <p className="header-status muted" role="status">{status}</p>}</div>
    <div className="header-actions"><ThemeControl /></div>
  </div></header>;
}
