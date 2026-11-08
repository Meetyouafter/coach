import {validate} from '../shared/validate.js';
const headers = {'cache-control':'no-store'};
export function createApp({page, assets = {}, media = {}}) {return {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = env.LOCAL_DEV === 'true' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    const user = local ? 'local-developer' : request.headers.get('oai-authenticated-user-id');
    if (!user) return new Response('Sign in required', {status:401, headers});
    if (request.method === 'GET' && Object.hasOwn(assets,url.pathname)) {
      const asset = assets[url.pathname];
      return new Response(asset.body, {headers:{...headers,'content-type':asset.type}});
    }
    const image = /^\/media\/([a-z]+)\.jpg$/.exec(url.pathname);
    if (image && request.method === 'GET' && Object.hasOwn(media,image[1])) {
      return new Response(Uint8Array.from(atob(media[image[1]]), c=>c.charCodeAt(0)), {headers:{'content-type':'image/jpeg','cache-control':'private, max-age=86400'}});
    }
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(page, {headers:{...headers,'content-type':'text/html; charset=utf-8'}});
    }
    if (url.pathname !== '/api/journal') return new Response(null,{status:404,headers});
    if (!env.DB) return Response.json({error:'Database binding DB is missing'},{status:503,headers});
    if (request.method === 'GET') {
      const row = await env.DB.prepare('SELECT revision, journal FROM workout_journals WHERE user_id = ?').bind(user).first();
      return Response.json(row ? {revision:row.revision,journal:JSON.parse(row.journal)} : {revision:0,journal:{}},{headers});
    }
    if (request.method !== 'PUT') return new Response(null,{status:405,headers});
    if (request.headers.get('origin') !== url.origin) return new Response(null,{status:403,headers});
    const body = await request.text();
    if (body.length > 500000) return new Response(null,{status:413,headers});
    let payload;
    try { payload = JSON.parse(body); validate({version:1,journal:payload.journal}); }
    catch { return new Response(null,{status:400,headers}); }
    const {revision,journal} = payload;
    if (!Number.isSafeInteger(revision) || revision < 0) return new Response(null,{status:400,headers});
    const encoded = JSON.stringify(journal);
    const query = revision === 0
      ? env.DB.prepare('INSERT INTO workout_journals (user_id,revision,journal) VALUES (?,1,?) ON CONFLICT(user_id) DO NOTHING').bind(user,encoded)
      : env.DB.prepare('UPDATE workout_journals SET journal = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?').bind(encoded,user,revision);
    const result = await query.run();
    if (!result.meta.changes) return new Response(null,{status:409,headers});
    return Response.json({revision:revision+1},{headers});
  }
};}
