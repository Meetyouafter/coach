import {weekdays} from './plan.js';

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
const legacySessionKey=v=>/^(?:[1-9]|1[0-2])-[0-3]$/.test(v);
const sessionKey=v=>legacySessionKey(v)||/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function validateWorkout(items) {
 if(!Array.isArray(items)||items.length>23||new Set(items.map(item=>item?.id)).size!==items.length)throw Error();
 for(const item of items){
  if(item?.id==='run'){
   if(!allowed(item,['id','target','tip','test'])||!text(item.target,500,true)||!text(item.tip,3000)||typeof item.test!=='boolean')throw Error();
  }else if(!allowed(item,['id','n','reps','weight','rir','rest','tip'])||!validIds.has(item.id)||!num(item.n,1,20,true)||!text(item.reps,80,true)||!text(item.weight,120)||!text(item.rir,30)||!num(item.rest,0,1800,true)||!text(item.tip,3000))throw Error();
 }
}
function validateSchedule(value, legacy = false, allowDuplicateDays = false) {
 if(!allowed(value,['note','kmMin','kmMax','days','dayNames'])||!text(value.note,1000)||!num(value.kmMin,0,800)||!num(value.kmMax,value.kmMin,800)||!Array.isArray(value.days)||value.days.length>100||(legacy&&value.days.length!==4))throw Error();
 if(value.dayNames!==undefined&&(!Array.isArray(value.dayNames)||value.dayNames.length!==value.days.length||!value.dayNames.every((name,index)=>text(name,100,value.days[index].length>0))))throw Error();
 if(!allowDuplicateDays&&value.dayNames){
  const scheduled=value.dayNames.filter(name=>weekdays.includes(name));
  if(new Set(scheduled).size!==scheduled.length)throw Error('На один день недели можно запланировать только одно занятие.');
 }
 value.days.forEach(validateWorkout);
}
export function validatePlan(plan, {allowDuplicateDays = false} = {}) {
 if(!object(plan)||!text(plan.name,100,true))throw Error();
 if(plan.weeks!==undefined){
  // Older plans remain readable while accounts move to a single reusable plan.
  if(!allowed(plan,['name','weeks'])||!object(plan.weeks))throw Error();
  for(const [week,value] of Object.entries(plan.weeks)){
   if(!/^(?:[1-9]|1[0-2])$/.test(week))throw Error();
   validateSchedule(value, true, allowDuplicateDays);
  }
 }else{
  if(!allowed(plan,['name','note','kmMin','kmMax','days','dayNames']))throw Error();
  const {name,...schedule}=plan;
  validateSchedule(schedule, false, allowDuplicateDays);
 }
 return plan;
}

function validate(parsed, options){
 const {trainingV2,...legacy}=object(parsed?.journal)?parsed.journal:{};
 if(parsed?.version!==1||!object(parsed.journal))throw Error();
 validateLegacy({version:1,journal:legacy});
 if(trainingV2===undefined)return parsed.journal;
 if(!allowed(trainingV2,['sessions','plan','dayChoices'])||!object(trainingV2.sessions))throw Error();
 if(trainingV2.dayChoices!==undefined){
  if(!object(trainingV2.dayChoices)||Object.keys(trainingV2.dayChoices).length>1000)throw Error();
  for(const [date,day] of Object.entries(trainingV2.dayChoices)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!num(day,0,99,true))throw Error();
  }
 }
 if(trainingV2.plan!==undefined)validatePlan(trainingV2.plan, options);
 for(const [key,s] of Object.entries(trainingV2.sessions)){
  if(!sessionKey(key)||!allowed(s,['status','date','sets','results','run','deferred','finished','plan','day','name'])||
   !['Начата','Выполнена','Облегчена','Пропущена'].includes(s.status)||!iso(s.date)||!object(s.sets)||
   (s.finished!=null&&!iso(s.finished))||(s.deferred!==undefined&&typeof s.deferred!=='boolean'))throw Error();
  if((!legacySessionKey(key)||s.day!==undefined)&&!num(s.day,0,99,true))throw Error();
  if(s.name!==undefined&&!text(s.name,100,true))throw Error();
  if(s.plan!==undefined)validateWorkout(s.plan);
  if(s.results!==undefined){
   if(!object(s.results))throw Error();
   for(const [id,r] of Object.entries(s.results)){
    if(!validIds.has(id)||!object(r)||!iso(r.date))throw Error();
    if(r.skip===true&&allowed(r,['skip','date']))continue;
    if(!allowed(r,['n','kg','value','unit','date','feeling'])||!num(r.n,1,20,true)||!num(r.kg,0,999)||!num(r.value,1,999,true)||!['sec','reps'].includes(r.unit)||(r.feeling!==undefined&&!num(r.feeling,1,5,true)))throw Error();
   }
  }
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
