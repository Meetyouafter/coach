import {CircleAlert} from 'lucide-react';

export function AuthField({name, label, error, hint, ...props}) {
  const id = 'account-' + name;
  return <label className={'form-field' + (error ? ' has-error' : '')} htmlFor={id}>
    <span className="form-field-label">{label}</span>
    <input {...props} id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-error' : hint ? id + '-hint' : undefined} />
    {error ? <span className="field-error" id={id + '-error'}><CircleAlert size={14} aria-hidden="true" /><span>{error}</span></span> : hint ? <span className="field-hint" id={id + '-hint'}>{hint}</span> : null}
  </label>;
}
