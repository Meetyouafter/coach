import {CircleAlert} from 'lucide-react';

export function ErrorNotice({message, title = 'Не удалось выполнить действие', onAction, actionLabel = 'Повторить', className = ''}) {
  if (!message) return null;
  return <div className={'error-notice ' + className} role="alert" aria-atomic="true">
    <CircleAlert className="error-notice-icon" size={20} strokeWidth={1.8} aria-hidden="true" />
    <div className="error-notice-content"><strong>{title}</strong><p>{message}</p>
      {onAction && <button type="button" className="error-notice-action" onClick={onAction}>{actionLabel}</button>}
    </div>
  </div>;
}
