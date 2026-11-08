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

const itemDone=(s,e)=>e.id==="run"?!!s?.run:Array.from({length:e.n},(_,i)=>s?.sets[e.id]?.[i]).every(Boolean);
export {lastRows,describe,numeric,validNumber,parseTime,pace,dateLabel,itemDone};
