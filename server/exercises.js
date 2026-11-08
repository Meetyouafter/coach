import {categories, equipmentLabels, normalizeExercise, searchTerm} from '../shared/exercise-catalog.js';
import {HttpError} from './http.js';

const base='https://oss.exercisedb.dev/api/v1/exercises';
export function exerciseQuery(params) {
  const category=params.get('category')??'';
  const equipment=params.get('equipment')??'';
  const query=(params.get('q')??'').trim();
  const after=params.get('after')??'';
  if(category&&!categories.some(item=>item.id===category))throw new HttpError(400,'Неизвестная категория.');
  if(equipment&&!Object.hasOwn(equipmentLabels,equipment))throw new HttpError(400,'Неизвестное оборудование.');
  if(query.length>100 || (after&&!/^[a-zA-Z0-9_-]{1,40}$/.test(after)))throw new HttpError(400,'Некорректные параметры поиска.');
  const upstream=new URL(base);
  upstream.searchParams.set('limit','24');
  if(category)upstream.searchParams.set('bodyParts',categories.find(item=>item.id===category).bodyPart);
  if(equipment)upstream.searchParams.set('equipments',equipment);
  if(query)upstream.searchParams.set('name',searchTerm(query));
  if(after)upstream.searchParams.set('after',after);
  return upstream;
}
export function createExerciseService({request=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map();
  return async params=>{
    const url=exerciseQuery(params), key=url.href;
    const hit=cache.get(key);
    if(hit&&hit.until>now())return hit.value;
    if(pending.has(key))return pending.get(key);
    const job=(async()=>{
      let response;
      try{response=await request(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12000)});}
      catch{throw new HttpError(502,'Не удалось загрузить упражнения. Попробуй ещё раз.');}
      if(response.status===429)throw new HttpError(429,'Каталог получил слишком много запросов. Подожди немного и повтори.');
      if(!response.ok)throw new HttpError(502,'Каталог упражнений временно недоступен. Попробуй позже.');
      let data;
      try{data=await response.json();}catch{throw new HttpError(502,'Не удалось прочитать каталог упражнений.');}
      if(data.success!==true||!Array.isArray(data.data))throw new HttpError(502,'Каталог вернул неожиданный ответ.');
      const cursor=data.meta?.nextCursor;
      const value={items:data.data.map(normalizeExercise).filter(Boolean),total:Number.isSafeInteger(data.meta?.total)?Math.max(0,data.meta.total):0,nextCursor:data.meta?.hasNextPage&&cursor!==params.get('after')&&typeof cursor==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(cursor)?cursor:null};
      if(cache.size>=120)cache.delete(cache.keys().next().value);
      cache.set(key,{value,until:now()+10*60*1000});
      return value;
    })();
    pending.set(key,job);
    try{return await job;}finally{pending.delete(key);}
  };
}
