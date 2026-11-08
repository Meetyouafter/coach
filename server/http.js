export class HttpError extends Error {
  constructor(status, message, fieldErrors) {super(message); this.status = status; this.fieldErrors = fieldErrors;}
}

export function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

export function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const forwarded = req.headers['x-forwarded-proto'];
    const protocol = forwarded === 'https' || req.socket?.encrypted ? 'https:' : 'http:';
    return origin.host === req.headers.host && origin.protocol === protocol;
  } catch {return false;}
}

export async function body(req, limit = 500000) {
  let raw;
  // Vercel parses JSON automatically; the local Vite middleware supplies a stream.
  if (req.body !== undefined) raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      const data = Buffer.from(chunk); bytes += data.length;
      if (bytes > limit) throw new HttpError(413, 'Слишком большой запрос.');
      chunks.push(data);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw ?? '') > limit) throw new HttpError(413, 'Слишком большой запрос.');
  try {return JSON.parse(raw);} catch {throw new HttpError(400, 'Некорректный JSON.');}
}

export function apiErrors(handler) {
  return async (req, res) => {
    try {await handler(req, res);}
    catch (error) {
      // Database errors may contain connection details; never send them to the client.
      json(res, error instanceof HttpError ? error.status : 503, {
        error: error instanceof HttpError ? error.message : 'База данных временно недоступна. Повтори позже.',
        ...(error instanceof HttpError && error.fieldErrors ? {fieldErrors:error.fieldErrors} : {}),
      });
    }
  };
}
