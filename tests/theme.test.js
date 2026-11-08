import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const script = await readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
function setup({saved = null, dark = false, blocked = false, supported = true} = {}) {
  const events = new Map(), mediaEvents = new Map(), classes = new Set();
  const media = {matches: dark, addEventListener: (key, listener) => mediaEvents.set(key, listener)};
  const root = {dataset: {}, style: {}, classList: {add: value => classes.add(value), remove: value => classes.delete(value)}};
  const meta = {};
  const storage = new Map(saved === null ? [] : [['coach-theme', saved]]);
  const window = {
    localStorage: {getItem(key) {if (blocked) throw Error(); return storage.get(key) ?? null;}, setItem(key, value) {if (blocked) throw Error(); storage.set(key, value);}},
    addEventListener: (key, listener) => events.set(key, listener),
  };
  if (supported) window.matchMedia = () => media;
  runInNewContext(script, {window, document: {documentElement: root, querySelector: () => meta}, setTimeout: () => 1, clearTimeout() {}});
  return {controller: window.coachTheme, root, meta, classes, storage,
    system(value) {media.matches = value; mediaEvents.get('change')?.();},
    external(value) {events.get('storage')({key: 'coach-theme', newValue: value});},
  };
}
test('saved theme wins over system, while unsupported or invalid preferences fall back to light', () => {
  const saved = setup({saved: 'light', dark: true});
  assert.equal(saved.root.dataset.theme, 'light');
  assert.equal(saved.classes.size, 0, 'first paint should not animate');
  assert.equal(setup({dark: true}).root.dataset.theme, 'dark');
  assert.equal(setup({supported: false}).root.dataset.theme, 'light');
  assert.equal(setup({saved: 'invalid', supported: false}).root.dataset.theme, 'light');
});
test('manual choice persists, notifies React and blocks system overrides until Auto is selected', () => {
  const app = setup(); let notified = 0;
  const unsubscribe = app.controller.subscribe(() => notified++);
  app.controller.setPreference('dark');
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.storage.get('coach-theme'), 'dark');
  assert.equal(app.meta.content, '#19191f');
  assert.equal(app.classes.has('theme-transition'), true);
  app.system(false);
  assert.equal(app.root.dataset.theme, 'dark');
  app.controller.setPreference('system');
  assert.equal(app.root.dataset.theme, 'light');
  app.system(true);
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(notified, 3);
  unsubscribe();
});
test('theme stays usable with blocked storage and follows changes in another tab', () => {
  const app = setup({blocked: true});
  app.controller.setPreference('dark');
  assert.equal(app.root.dataset.theme, 'dark');
  app.external('light');
  assert.equal(app.root.dataset.theme, 'light');
  app.system(true);
  app.external(null);
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.controller.getSnapshot().preference, 'system');
});
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}
for (const mode of ['light', 'dark']) {
  test(`${mode} theme meets WCAG AA text contrast and control boundaries`, () => {
    const block = css.split(`:root[data-theme="${mode}"]`)[1].split('}')[0];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(([, key, value]) => [key, value]));
    for (const foreground of ['fg', 'muted', 'accent', 'secondary', 'error']) for (const background of ['bg', 'panel', 'control', 'hover']) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      assert.ok(ratio >= 4.5, `${mode}: ${foreground}/${background} = ${ratio.toFixed(2)} < 4.5`);
    }
    assert.ok(contrast(tokens['on-accent'], tokens.accent) >= 4.5);
    assert.ok(contrast(tokens.fg, tokens['accent-soft']) >= 4.5);
    const [, r, g, b, percent] = block.match(/--header-glass:\s*rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/);
    const opacity = Number(percent) / 100;
    const behind = mode === 'light' ? 0 : 255;
    const glass = '#' + [r, g, b].map(channel => Math.round(Number(channel) * opacity + behind * (1 - opacity)).toString(16).padStart(2, '0')).join('');
    for (const foreground of ['fg', 'muted', 'accent']) {
      assert.ok(contrast(tokens[foreground], glass) >= 4.5, `${mode}: ${foreground} on translucent header < 4.5`);
    }
    for (const background of ['bg', 'panel', 'control']) for (const foreground of ['line', 'focus']) {
      assert.ok(contrast(tokens[foreground], tokens[background]) >= 3, `${mode}: ${foreground}/${background} boundary < 3`);
    }
  });
}
