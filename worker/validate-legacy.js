const plan = [{items:{length:7}},{items:{length:5}},{items:{length:8}},{items:{length:2}}];
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function validateLegacy(parsed) {
  if (parsed?.version !== 1 || !object(parsed.journal)) throw new Error();
  for (const [w,days] of Object.entries(parsed.journal)) {
    if (!/^[1-9][0-9]{0,2}$/.test(w) || !object(days)) throw new Error();
    for (const [d,entries] of Object.entries(days)) {
      if (!/^[0-3]$/.test(d) || !object(entries)) throw new Error();
      for (const [i,value] of Object.entries(entries)) {
        if (i === 'note' && typeof value === 'string' && value.length <= 3000) continue;
        if (!/^[0-9]$/.test(i) || Number(i) >= plan[d].items.length || !object(value)) throw new Error();
        for (const [k,v] of Object.entries(value)) {
          if (k === 'done' && typeof v === 'boolean') continue;
          if (!['a','b','c'].includes(k) || typeof v !== 'string' || v.length > 30) throw new Error();
        }
      }
    }
  }
  return parsed.journal;
}
