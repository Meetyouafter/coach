function lastRows(journal,id,key) {
 const rows=[];
 for(const [k,s] of Object.entries((journal.trainingV2?.sessions??{}))) {
  if(k===key)continue;
  for(const [i,r] of Object.entries(s.sets[id]??{}))if(!r.skip)rows.push({...r,i:Number(i),date:r.date??s.date,k});
 }
 const legacy=[
 ['bench','leg','rdl','row','calf',null,'side'],
 ['press','chestrow','lateral',null,'bug'],
 ['lunge','bridge','incline','lat','seated','ham',null,'pallof'],[null,'crunch']
 ];
 for(const [week,days] of Object.entries(journal)) {
  if(!/^\d+$/.test(week))continue;
  for(const [day,records] of Object.entries(days)) {
   const index=legacy[day]?.indexOf(id);
   if(index==null||index<0)continue;
   const old=records[index];
   if(old) ['b','c'].forEach((field,i)=>{if(old[field])rows.push({i,kg:old.a,value:old[field],k:'старый журнал · неделя '+week});});
  }
 }
 return rows.sort((a,b)=>(b.date??'').localeCompare(a.date??'')||b.i-a.i);
}
const describe=r=>[r.kg!==''&&r.kg!=null?r.kg+' кг':null,r.value!=null?r.value+(r.unit==='sec'?' сек.':''):null,r.effort!=null?'усилие '+r.effort+'/10':null].filter(Boolean).join(' × ');
const numeric=value=>Number(value.trim().replace(',','.'));
function validNumber(value,min,max,integer=false) {
 const n=numeric(value);return value.trim()!==''&&Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n));
}
function parseTime(value) {
 const p=value.trim().replace(',','.').split(':');
 if(p.length>3||!p.every(x=>/^\d+(\.\d+)?$/.test(x)))return NaN;
 if(p.length===1)return Number(p[0])*60;
 if(p.slice(1).some(x=>Number(x)>=60))return NaN;
 return p.reduce((a,x)=>a*60+Number(x),0);
}
function pace(km,sec) {const p=Math.round(sec/km);return Math.floor(p/60)+':'+String(p%60).padStart(2,'0')+'/км';}

const dateLabel=value=>value?new Date(value).toLocaleDateString("ru-RU"):"Дата не сохранена";
const localDateKey=(value=new Date())=>{const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};

function exerciseSummary(session, id) {
 const result=session.results?.[id];
 if(result)return result.skip?null:{...result,maxKg:result.kg};
 const rows=Object.values(session.sets?.[id]??{}).filter(row=>!row.skip).sort((a,b)=>(a.date??'').localeCompare(b.date??''));
 if(!rows.length)return null;
 const last=rows.at(-1),weights=rows.map(row=>row.kg).filter(value=>typeof value==='number'),values=rows.map(row=>row.value);
 return {n:rows.length,kg:typeof last.kg==='number'?last.kg:0,value:last.value,unit:last.unit??'reps',date:last.date??session.date,legacy:true,maxKg:Math.max(0,...weights),kgRange:weights.length?[Math.min(...weights),Math.max(...weights)]:null,valueRange:[Math.min(...values),Math.max(...values)]};
}
const sessionResults=session=>[...new Set([...Object.keys(session.sets??{}),...Object.keys(session.results??{})])].flatMap(id=>{const result=exerciseSummary(session,id);return result?[{id,...result}]:[];});
const sessionSetCount=session=>sessionResults(session).reduce((total,result)=>total+result.n,0);
function lastExerciseResults(journal,id,key) {
 return Object.entries(journal.trainingV2?.sessions??{}).flatMap(([k,session])=>{const result=exerciseSummary(session,id);return k!==key&&result?[{...result,k}]:[];}).sort((a,b)=>b.date.localeCompare(a.date));
}
const rangeText=range=>range[0]===range[1]?String(range[0]):range.join('–');
const describeResult=result=>`${result.n} × ${result.valueRange?rangeText(result.valueRange):result.value} ${result.unit==='sec'?'сек.':'повт.'}${result.legacy&&!result.kgRange?' · вес не указан':' · '+(result.kgRange?rangeText(result.kgRange):result.kg)+' кг'}`;
const itemDone=(s,e)=>e.id==='run'?!!s?.run:s?.results?.[e.id]?true:Array.from({length:e.n},(_,i)=>s?.sets[e.id]?.[i]).every(Boolean);
export {lastRows,describe,numeric,validNumber,parseTime,pace,dateLabel,localDateKey,itemDone,exerciseSummary,sessionResults,sessionSetCount,lastExerciseResults,describeResult};
