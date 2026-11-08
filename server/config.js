export function databaseConfigError(env = process.env) {
  if (!env.DATABASE_URL) return 'Задай DATABASE_URL в .env.local: строку подключения из Neon → Connect.';
  try {
    const url = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) throw Error();
    if (url.hostname.toLowerCase() === 'host' || url.username === 'USER' || url.password === 'PASSWORD') {
      return 'DATABASE_URL содержит пример USER:PASSWORD@HOST. Замени его полной строкой подключения из Neon → Connect.';
    }
  } catch {return 'DATABASE_URL должна содержать полную PostgreSQL-строку подключения из Neon → Connect.';}
  return null;
}

export function configurationErrors(env = process.env) {
  const errors = [databaseConfigError(env)];
  const secret = env.AUTH_SECRET ?? env.APP_PASSWORD;
  if (!secret || secret.length < 16 || secret.length > 1024) {
    errors.push('Задай AUTH_SECRET длиной 16–1024 символа в .env.local или переменных окружения Vercel.');
  }
  return errors.filter(Boolean);
}
