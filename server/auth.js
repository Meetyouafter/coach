import {createHash, createHmac, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {HttpError} from './http.js';

const derive = promisify(scrypt);
const cookieName = 'coach_session';
const maxAge = 30 * 24 * 60 * 60;
const digest = value => createHash('sha256').update(value).digest();
const signature = (value, key) => createHmac('sha256', key).update(value).digest('base64url');
export function authSecret(env = process.env) {
  // APP_PASSWORD keeps existing deployments working while AUTH_SECRET is configured.
  const value = env.AUTH_SECRET ?? env.APP_PASSWORD;
  if (!value || value.length < 16 || value.length > 1024) throw new HttpError(503, 'Задай AUTH_SECRET длиной от 16 до 1024 символов в настройках сервера.');
  return value;
}
export function passwordLookup(password, env = process.env) {
  return createHmac('sha256', authSecret(env)).update('coach-user-v1\0').update(password).digest('hex');
}
export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await derive(password, salt, 32, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024});
  return {salt, hash: hash.toString('hex')};
}
export async function verifyPassword(password, user) {
  const {hash} = await hashPassword(password, user.password_salt);
  return timingSafeEqual(digest(hash), digest(user.password_hash));
}
export function matchesLegacyOwner(password, env = process.env) {
  return !!env.APP_PASSWORD && timingSafeEqual(digest(password), digest(env.APP_PASSWORD));
}
export function issueSession(userId, env = process.env, now = Date.now()) {
  if (!/^[a-f0-9-]{36}$/.test(userId)) throw Error('Invalid user id');
  const payload = `v4.${userId}.${Math.floor(now / 1000) + maxAge}.${randomBytes(16).toString('hex')}`;
  return payload + '.' + signature(payload, authSecret(env));
}
export function authenticatedSession(req, env = process.env, now = Date.now()) {
  const key = authSecret(env);
  const value = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!value || value.length > 256) return null;
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v4' || !/^[a-f0-9-]{36}$/.test(parts[1]) || !/^\d+$/.test(parts[2]) || !/^[a-f0-9]{32}$/.test(parts[3])) return null;
  const expected = signature(parts.slice(0, 4).join('.'), key);
  return Number(parts[2]) > Math.floor(now / 1000) && timingSafeEqual(digest(parts[4]), digest(expected)) ? {userId: parts[1]} : null;
}
export function authenticatedUser(req, env = process.env, now = Date.now()) {
  return authenticatedSession(req, env, now)?.userId ?? null;
}
export function sessionCookie(req, value) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted || process.env.VERCEL;
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? maxAge : 0}${secure ? '; Secure' : ''}`;
}
