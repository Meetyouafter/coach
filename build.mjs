import {readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync} from 'node:fs';
import {build} from 'esbuild';

const file = name => new URL(name, import.meta.url);
const client = await build({
  entryPoints: ['src/main.jsx'], bundle: true, minify: true, write: false,
  jsx: 'automatic', format: 'iife', target: ['es2022'],
  define: {'process.env.NODE_ENV': '"production"'},
});
const page = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content"><meta name="theme-color" content="#131717"><title>Зал и бег</title><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div><script defer src="/assets/app.js"></script></body></html>';
const assets = {
  '/assets/app.js': {type: 'text/javascript; charset=utf-8', body: client.outputFiles[0].text},
  '/assets/app.css': {type: 'text/css; charset=utf-8', body: readFileSync(file('./src/styles.css'), 'utf8')},
};
const media = Object.fromEntries(readdirSync(file('./worker/media/')).map(name => [name.slice(0, -4), readFileSync(file('./worker/media/' + name)).toString('base64')]));
const server = await build({
  stdin: {contents: `import {createApp} from './worker/server.js';\nexport default createApp(${JSON.stringify({page, assets, media})});`, resolveDir: process.cwd(), sourcefile: 'server-entry.js'},
  bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2022',
});
mkdirSync(file('./dist/server/'), {recursive: true});
mkdirSync(file('./dist/.openai/'), {recursive: true});
copyFileSync(file('./.openai/hosting.json'), file('./dist/.openai/hosting.json'));
writeFileSync(file('./dist/server/index.js'), server.outputFiles[0].contents);
console.log('React client and D1 Worker built: dist/server/index.js');
