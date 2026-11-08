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

const validIds=new Set('bench leg rdl row calf tib side press chestrow lateral curl triceps bug lunge bridge incline lat seated ham pallof crunch pogo'.split(' '));
const allowed=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const iso=v=>typeof v==='string'&&v.length<=32&&Number.isFinite(Date.parse(v));
const num=(v,min,max,int=false)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!int||Number.isInteger(v));
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
const sessionKey=v=>/^(?:[1-9]|1[0-2])-[0-3]$/.test(v);
function validateWorkout(items) {
 if(!Array.isArray(items)||items.length>23||new Set(items.map(item=>item?.id)).size!==items.length)throw Error();
 for(const item of items){
  if(item?.id==='run'){
   if(!allowed(item,['id','target','tip','test'])||!text(item.target,500,true)||!text(item.tip,3000)||typeof item.test!=='boolean')throw Error();
  }else if(!allowed(item,['id','n','reps','weight','rir','rest','tip'])||!validIds.has(item.id)||!num(item.n,1,20,true)||!text(item.reps,80,true)||!text(item.weight,120)||!text(item.rir,30)||!num(item.rest,0,1800,true)||!text(item.tip,3000))throw Error();
 }
}
export function validatePlan(plan) {
 if(!allowed(plan,['name','weeks'])||!text(plan.name,100,true)||!object(plan.weeks))throw Error();
 for(const [week,value] of Object.entries(plan.weeks)){
  if(!/^(?:[1-9]|1[0-2])$/.test(week)||!allowed(value,['note','kmMin','kmMax','days'])||!text(value.note,1000)||!num(value.kmMin,0,800)||!num(value.kmMax,value.kmMin,800)||!Array.isArray(value.days)||value.days.length!==4)throw Error();
  value.days.forEach(validateWorkout);
 }
 return plan;
}
function validate(parsed){
 const {trainingV2,...legacy}=object(parsed?.journal)?parsed.journal:{};
 if(parsed?.version!==1||!object(parsed.journal))throw Error();
 validateLegacy({version:1,journal:legacy});
 if(trainingV2===undefined)return parsed.journal;
 if(!allowed(trainingV2,['sessions','plan'])||!object(trainingV2.sessions))throw Error();
 if(trainingV2.plan!==undefined)validatePlan(trainingV2.plan);
 for(const [key,s] of Object.entries(trainingV2.sessions)){
  if(!sessionKey(key)||!allowed(s,['status','date','sets','run','deferred','finished','plan'])||
   !['Начата','Выполнена','Облегчена','Пропущена'].includes(s.status)||!iso(s.date)||!object(s.sets)||
   (s.finished!=null&&!iso(s.finished))||(s.deferred!==undefined&&typeof s.deferred!=='boolean'))throw Error();
  if(s.plan!==undefined)validateWorkout(s.plan);
  for(const [id,sets] of Object.entries(s.sets)){
   if(!validIds.has(id)||!object(sets))throw Error();
   for(const [i,r] of Object.entries(sets)){
    if(!/^(?:[0-9]|1[0-9])$/.test(i)||!object(r)||!iso(r.date))throw Error();
    if(r.skip===true&&allowed(r,['skip','date']))continue;
    if(!allowed(r,['kg','value','unit','effort','date'])||!(r.kg===''||num(r.kg,0,999))||!num(r.value,1,999,true)||!['sec','reps'].includes(r.unit)||!num(r.effort,1,10,true))throw Error();
   }
  }
  if(s.run!==undefined){
   const r=s.run;
   if(!allowed(r,['km','time','sec','pulse','incline','effort'])||!num(r.km,.01,200)||typeof r.time!=='string'||r.time.length>24||!num(r.sec,.01,86400)||!(r.pulse===''||num(r.pulse,20,260,true))||!(r.incline===''||num(r.incline,-10,45))||!num(r.effort,1,10,true))throw Error();
  }
 }
 return parsed.journal;
}

export { validate };
