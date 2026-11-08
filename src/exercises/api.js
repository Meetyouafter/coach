const cache=new Map();
export async function loadExercises({query='',category='',equipment='',after=''}={},signal) {
  const params=new URLSearchParams();
  if(query.trim())params.set('q',query.trim());
  if(category)params.set('category',category);
  if(equipment)params.set('equipment',equipment);
  if(after)params.set('after',after);
  const key=params.toString();
  const hit=cache.get(key);
  if(hit&&hit.until>Date.now())return hit.data;
  let response;
  try{response=await fetch('/api/exercises?'+key,{signal});}
  catch(error){if(error.name==='AbortError')throw error;throw Error('Проверь соединение и попробуй загрузить упражнения ещё раз.');}
  let result;
  try{result=await response.json();}catch{throw Error('Не удалось прочитать каталог. Попробуй ещё раз.');}
  if(!response.ok)throw Error(result.error||'Каталог упражнений временно недоступен.');
  if(!Array.isArray(result.items))throw Error('Не удалось прочитать каталог.');
  if(cache.size>=120)cache.delete(cache.keys().next().value);
  cache.set(key,{data:result,until:Date.now()+10*60*1000});
  return result;
}
