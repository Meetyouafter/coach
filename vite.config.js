import {defineConfig} from 'vite';
import journal from './api/journal.js';
import session from './api/session.js';
import exercises from './api/exercises.js';

export default defineConfig({
  esbuild: {jsx: 'automatic'},
  plugins: [{
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url.split('?')[0];
        if (path === '/api/journal') return journal(req, res);
        if (path === '/api/session') return session(req, res);
        if (path === '/api/exercises') return exercises(req, res);
        if (path.startsWith('/api/')) {res.statusCode = 404; res.end(); return;}
        next();
      });
    },
  }],
});
