import {readFile} from 'node:fs/promises';
import {databaseQuery} from '../server/database.js';
import {HttpError} from '../server/http.js';

try {
  const query = databaseQuery();
  await query(await readFile(new URL('../db/0001_journal.sql', import.meta.url), 'utf8'));
  console.log('PostgreSQL schema is ready.');
} catch (error) {
  console.error(error instanceof HttpError ? error.message : 'Database setup failed. Set DATABASE_URL to the Neon connection string and check database availability.');
  process.exitCode = 1;
}
