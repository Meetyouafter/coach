import {useEffect, useRef} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import {CalendarDays, Dumbbell, History, House, LogOut, TrendingUp, X} from 'lucide-react';

const icons = {today: House, plan: CalendarDays, exercises: Dumbbell, history: History, progress: TrendingUp};

export function Sidebar({items, onSignOut, open, onClose}) {
  const location = useLocation();
  const dialog = useRef(null);
  useEffect(() => {
    if (open) dialog.current.showModal();
    else dialog.current.close();
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 900px)');
    const closeOnDesktop = () => {if (desktop.matches) onClose();};
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [onClose]);
  function content(mobile = false) {
    return <>
      <div className="sidebar-heading"><span>Мой журнал</span>{mobile && <button type="button" onClick={onClose} aria-label="Закрыть меню"><X size={20} aria-hidden="true" /></button>}</div>
      <nav className="sidebar-nav" aria-label="Разделы приложения">{items.map(([id, label, path]) => {
        const Icon = icons[id];
        return <NavLink key={id} to={path} className={({isActive}) => isActive || (id === 'today' && location.pathname.startsWith('/workouts/')) ? 'active' : undefined} onClick={onClose}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></NavLink>;
      })}</nav>
      <div className="sidebar-footer"><button className="sign-out" type="button" onClick={() => {onClose(); void onSignOut();}}><LogOut size={20} strokeWidth={1.8} aria-hidden="true" /><span>Выйти из аккаунта</span></button></div>
    </>;
  }
  return <>
    <aside className="sidebar">{content()}</aside>
    <dialog ref={dialog} id="mobile-sidebar" className="sidebar-drawer" aria-label="Меню приложения" onClose={onClose} onClick={event => {if (event.target === event.currentTarget) {const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();}}}><div className="sidebar-drawer-content">{content(true)}</div></dialog>
  </>;
}
