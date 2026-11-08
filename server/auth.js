import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {HttpError} from './http.js';

const cookieName = 'coach_session';
const maxAge = 30 * 24 * 60 * 60;
function secret(env) {
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16) throw new HttpError(503, 'Задай APP_PASSWORD длиной от 16 символов в настройках сервера.');
  return env.APP_PASSWORD;
}
const digest = value => createHash('sha256').update(value).digest();
const signature = (value, key) => createHmac('sha256', key).update(value).digest('base64url');
export function passwordMatches(password, env = process.env) {
  return typeof password === 'string' && timingSafeEqual(digest(password), digest(secret(env)));
}
export function issueSession(env = process.env, now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + maxAge}.${randomBytes(16).toString('hex')}`;
  return payload + '.' + signature(payload, secret(env));
}
export function authenticated(req, env = process.env, now = Date.now()) {
  const key = secret(env);
  const value = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (!value || value.length > 256) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1])) return false;
  const expected = signature(parts.slice(0, 2).join('.'), key);
  return Number(parts[0]) > Math.floor(now / 1000) && timingSafeEqual(digest(parts[2]), digest(expected));
}
export function sessionCookie(req, value) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted || process.env.VERCEL;
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? maxAge : 0}${secure ? '; Secure' : ''}`;
}
