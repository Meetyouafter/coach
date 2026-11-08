import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAccount, normalizeLoginValue} from '../shared/account-validation.js';

test('empty and invalid fields receive specific errors for inline feedback',()=>{
  const errors=validateAccount({},'register');
  assert.deepEqual(Object.keys(errors),['login','password','confirmPassword']);
  assert.match(errors.login,/Введи логин/);
  assert.match(validateAccount({login:'ab',password:'x',confirmPassword:'y'},'register').password,/12/);
  assert.ok(validateAccount({login:'invalid name',password:'123456789012',confirmPassword:'123456789012'},'register').login);
});
test('correcting password and confirmation clears their messages without rejecting existing short login passwords',()=>{
  const valid={login:' Alice ',password:'123456789012',confirmPassword:'123456789012'};
  assert.deepEqual(validateAccount(valid,'register'),{});
  assert.equal(normalizeLoginValue(valid.login),'alice');
  assert.ok(validateAccount({...valid,confirmPassword:'different'},'register').confirmPassword);
  assert.deepEqual(validateAccount({login:'alice',password:'a'},'login'),{});
});
