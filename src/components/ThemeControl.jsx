import {useSyncExternalStore} from 'react';
import * as Switch from '@radix-ui/react-switch';
import {Moon, Sun} from 'lucide-react';

export function ThemeControl() {
  const controller = window.coachTheme;
  const {theme} = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const dark = theme === 'dark';
  return <Switch.Root
    className="theme-toggle"
    checked={dark}
    onCheckedChange={checked => controller.setPreference(checked ? 'dark' : 'light')}
    aria-label="Тёмная тема"
    title={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
  >
    <Sun className="theme-toggle-sun" size={19} strokeWidth={1.8} aria-hidden="true" />
    <Moon className="theme-toggle-moon" size={18} strokeWidth={1.8} aria-hidden="true" />
    <Switch.Thumb className="theme-toggle-thumb" />
  </Switch.Root>;
}
