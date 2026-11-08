import {useEffect, useRef} from 'react';
import {CalendarDays, Dumbbell, History, House, LogOut, X} from 'lucide-react';

const icons = {today: House, plan: CalendarDays, exercises: Dumbbell, history: History};

export function Sidebar({items, tab, onSelect, onSignOut, open, onClose}) {
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
  function select(id) {onSelect(id); onClose();}
  function content(mobile = false) {
    return <>
      <div className="sidebar-heading"><span>Мой журнал</span>{mobile && <button type="button" onClick={onClose} aria-label="Закрыть меню"><X size={20} aria-hidden="true" /></button>}</div>
      <nav className="sidebar-nav" aria-label="Разделы приложения">{items.map(([id, label]) => {
        const Icon = icons[id];
        return <button type="button" key={id} aria-current={tab === id} onClick={() => select(id)}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></button>;
      })}</nav>
      <div className="sidebar-footer"><button className="sign-out" type="button" onClick={() => {onClose(); void onSignOut();}}><LogOut size={20} strokeWidth={1.8} aria-hidden="true" /><span>Выйти из аккаунта</span></button></div>
    </>;
  }
  return <>
    <aside className="sidebar">{content()}</aside>
    <dialog ref={dialog} id="mobile-sidebar" className="sidebar-drawer" aria-label="Меню приложения" onClose={onClose} onClick={event => {if (event.target === event.currentTarget) {const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();}}}><div className="sidebar-drawer-content">{content(true)}</div></dialog>
  </>;
}
