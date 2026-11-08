import {ChevronDown} from 'lucide-react';

export function SelectField({children, ...props}) {
  return <span className="select-field"><select {...props}>{children}</select><ChevronDown size={18} aria-hidden="true" /></span>;
}
