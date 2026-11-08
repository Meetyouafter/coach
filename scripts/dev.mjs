import {createServer} from 'vite';
import {configurationErrors} from '../server/config.js';

const errors = configurationErrors();
if (errors.length) {
  errors.forEach(error => console.error(error));
  process.exit(1);
}

const server = await createServer({server: {host: '127.0.0.1'}});
await server.listen();
server.printUrls();
