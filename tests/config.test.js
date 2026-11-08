import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configurationErrors, databaseConfigError} from '../server/config.js';

test('startup identifies missing, invalid and example database settings without exposing credentials', () => {
  assert.equal(configurationErrors({}).length, 2);
  const example = 'postgresql://USER:PASSWORD@HOST/neondb?sslmode=require';
  assert.match(databaseConfigError({DATABASE_URL: example}), /содержит пример/);
  assert.ok(databaseConfigError({DATABASE_URL: 'https://example.test/db'}));
  const valid = {DATABASE_URL: 'postgresql://owner:private-value@db.example.test/neondb?sslmode=require', APP_PASSWORD: 'valid-local-password'};
  assert.deepEqual(configurationErrors(valid), []);
  assert.ok(!configurationErrors({...valid, APP_PASSWORD: ''}).join().includes('private-value'));
});
