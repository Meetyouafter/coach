import {readFile, readdir} from 'node:fs/promises';
import {databaseQuery} from '../server/database.js';
import {HttpError} from '../server/http.js';

try {
  const query = databaseQuery();
  const directory = new URL('../db/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    await query(await readFile(new URL(name, directory), 'utf8'));
    console.log('Applied ' + name);
  }
  console.log('PostgreSQL schema is ready.');
} catch (error) {
  console.error(error instanceof HttpError ? error.message : 'Database setup failed. Set DATABASE_URL to the Neon connection string and check database availability.');
  process.exitCode = 1;
}
