import {useEffect, useRef} from 'react';
import {ErrorNotice} from './ErrorNotice.jsx';

export function DeleteWorkoutDialog({name, busy, error, onConfirm, onCancel}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className="plan-delete-dialog" role="alertdialog" aria-labelledby="delete-workout-title" aria-describedby="delete-workout-description" aria-busy={busy} onCancel={event => {event.preventDefault(); if (!busy) onCancel();}} onClick={event => {
    if (busy || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel();
  }}>
    <h2 id="delete-workout-title">Удалить занятие?</h2>
    <p id="delete-workout-description">Занятие «{name}» будет удалено из плана. История тренировок сохранится.</p>
    <ErrorNotice title="Не удалось удалить занятие" message={error} />
    <div className="plan-delete-dialog-actions"><button type="button" autoFocus disabled={busy} onClick={onCancel}>Отмена</button><button type="button" className="plan-delete-button" disabled={busy} onClick={onConfirm}>{busy ? 'Удаляем…' : 'Удалить'}</button></div>
  </dialog>;
}
