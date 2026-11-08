/* Runs before the app and styles to avoid a flash of the wrong theme. */
(() => {
  const key = 'coach-theme';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let media;
  try {media = window.matchMedia('(prefers-color-scheme: dark)');} catch { /* Light is the fallback. */ }
  let preference = 'system';
  try {const saved = window.localStorage.getItem(key); if (valid(saved)) preference = saved;} catch { /* Preferences still work for this visit. */ }
  let snapshot;
  let timer;
  const listeners = new Set();
  const root = document.documentElement;
  function apply(animate = true) {
    const theme = preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference;
    if (snapshot?.theme === theme && snapshot.preference === preference) return;
    if (animate && snapshot?.theme !== theme) {
      root.classList.add('theme-transition');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('theme-transition'), 500);
    }
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#19191f' : '#f6f3ec';
    snapshot = Object.freeze({preference, theme});
    listeners.forEach(listener => listener());
  }
  window.coachTheme = {
    getSnapshot: () => snapshot,
    subscribe(listener) {listeners.add(listener); return () => listeners.delete(listener);},
    setPreference(value) {
      if (!valid(value)) return;
      preference = value;
      try {window.localStorage.setItem(key, value);} catch { /* Storage may be disabled. */ }
      apply();
    },
  };
  media?.addEventListener?.('change', () => {if (preference === 'system') apply();});
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    apply();
  });
  apply(false);
})();
