const $=id=>document.getElementById(id);
const node=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,fn,cls='')=>{const e=node('button',label,cls);e.onclick=fn;return e;};
const section=(...children)=>{const e=node('section','','panel');e.append(...children);$('screen').append(e);return e;};
const stateKey='zal-beg-cloud-v2';
let journal={},rev=0,loaded=false,dirty=false,sending=false,conflict=false,timer,epoch=0;
let tab='today',w=1,d=0,active=null,ix=0,slot=0,until=0,restJob,filter='',historyKey='';
const statuses=['Начата','Выполнена','Облегчена','Пропущена'];
const status=text=>{$('sync').textContent=text;};
const v2=()=>journal.trainingV2??={sessions:{}};
const sessionKey=()=>w+'-'+d;
const current=()=>v2().sessions[sessionKey()];
const order=()=>workout(w,d,current()?.deferred);
const stamp=()=>new Date().toISOString();
const dateLabel=value=>value?new Date(value).toLocaleDateString('ru-RU'):'Дата не сохранена';
const err=text=>{const p=$('error');if(p){p.textContent=text;p.scrollIntoView({block:'nearest'});}};
function local() {
 try {localStorage.setItem(stateKey,JSON.stringify({journal,rev,dirty}));return true;}catch{return false;}
}
function persist() {
 dirty=true;epoch++;status(local()?'Сохранено на устройстве':'Локальное сохранение недоступно');
 clearTimeout(timer);timer=setTimeout(push,300);
}
async function push() {
 if(!loaded||!dirty||sending||conflict)return;
 sending=true;const start=epoch;
 try {
  const r=await fetch('/api/journal',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({revision:rev,journal})});
  if(r.status===409){conflict=true;throw Error('Журнал изменился на другом устройстве. Экспортируй местную копию перед обновлением.');}
  if(!r.ok)throw Error('Облако недоступно. Повторю при восстановлении связи.');
  rev=(await r.json()).revision;dirty=epoch!==start;local();status(dirty?'Сохранено на устройстве':'Синхронизировано');
 }catch(e){status(e.message);}finally{sending=false;if(epoch!==start&&!conflict)void push();}
}
function itemDone(s,e) {
 if(e.id==='run')return !!s?.run;
 const entries=s?.sets[e.id]??{};
 return Array.from({length:e.n},(_,i)=>entries[i]).every(Boolean);
}
function openSession(key) {
 [w,d]=key.split('-').map(Number);active=key;tab='today';
 const s=current(), list=order();
 ix=Math.max(0,list.findIndex(e=>!itemDone(s,e)));
 if(list.every(e=>itemDone(s,e)))ix=list.length;
 slot=-1; render();
}
function start() {
 const key=sessionKey();
 if(!current()) {v2().sessions[key]={status:'Начата',date:stamp(),sets:{}};persist();}
 openSession(key);
}
function lastRows(id,key) {
 const rows=[];
 for(const [k,s] of Object.entries(v2().sessions)) {
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
function chooseSlot(s,e) {
 const entries=s.sets[e.id]??{};
 if(slot<0)slot=Array.from({length:e.n},(_,i)=>i).find(i=>!entries[i])??0;
 return entries;
}
function input(form,title,key,value='',required=false,mode='decimal') {
 const label=node('label',title);const el=node('input');el.name=key;el.inputMode=mode;el.value=value??'';el.required=required;label.append(el);form.append(label);return el;
}
function action(label,fn) {$('action').hidden=false;$('action').textContent=label;$('action').onclick=fn;}
function technique(e) {
 $('techTitle').textContent=e.name;$('techBody').textContent=e.tip;
 $('techLinks').replaceChildren();
 const slug=externalDemos[e.id];
 const link=node('a',slug?'Демонстрация · MuscleWiki':'Найти внешнюю демонстрацию · '+e.query);
 link.href=slug?'https://musclewiki.com/exercise/'+slug:'https://www.youtube.com/results?search_query='+encodeURIComponent(e.query+' exercise form');
 link.target='_blank';link.rel='noopener noreferrer';
 $('techLinks').append(link);$('tech').showModal();
}
$('closeTech').onclick=()=>$('tech').close();
function rest(seconds) {until=Date.now()+seconds*1000;render();}
function showTimer() {
 if(until<=Date.now())return;
 const t=node('strong'); const tick=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));t.textContent='Отдых · '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0');if(!left)clearInterval(restJob);};
 const box=section(t,button('Пропустить',()=>{until=0;render();}),button('+30 сек',()=>{until=Math.max(until,Date.now())+30000;tick();}));box.classList.add('row','timer');tick();restJob=setInterval(tick,1000);
}
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
function editRun(s,e) {
 const old=s.run??{};
 const form=node('form','','grid');
 const km=input(form,'Дистанция, км','km',old.km,true);
 const time=input(form,'Время, мин или мм:сс','time',old.time,true,'text');
 const pulse=input(form,'Средний пульс','pulse',old.pulse,false,'numeric');
 const incline=input(form,'Наклон, %','incline',old.incline);
 const effort=input(form,'Усилие 1–10','effort',old.effort,true,'numeric');
 const line=node('p','','run');
 const show=()=>{const k=numeric(km.value), t=parseTime(time.value);line.textContent=k>0&&t>0?'Средний темп '+pace(k,t):'';};
 km.oninput=time.oninput=show;show();
 const box=section(node('h2',e.name,'run'),node('strong',e.target),node('p',e.tip),form,line);
 if(w===12&&d===3){
  box.append(node('p',ready),button(s.deferred?'Вернуть тест':'Перенести тест',()=>{s.deferred=!s.deferred;persist();render();}));
 }
 form.onsubmit=event=>{
  event.preventDefault();const t=parseTime(time.value);
  if(!validNumber(km.value,.01,200)||time.value.trim().length>24||!(t>=.01&&t<=86400)||!validNumber(effort.value,1,10,true)||pulse.value&&!validNumber(pulse.value,20,260,true)||incline.value&&!validNumber(incline.value,-10,45)){err('Проверь дистанцию, время, пульс, наклон и усилие.');return;}
  s.run={km:numeric(km.value),time:time.value.trim(),sec:t,pulse:pulse.value?numeric(pulse.value):'',incline:incline.value?numeric(incline.value):'',effort:numeric(effort.value)};
  persist();advance();
 };
 action('Сохранить бег',()=>form.requestSubmit());
}
function advance() {
 const list=order(),s=current();
 const next=list.findIndex((e,i)=>i>ix&&!itemDone(s,e));
 const first=list.findIndex(e=>!itemDone(s,e));
 ix=next>=0?next:first>=0?first:list.length;slot=-1;render();focusCard();
}
function focusCard(){document.querySelector('#screen form')?.closest('.panel')?.scrollIntoView({block:'nearest'});}
function editLift(s,e) {
 const records=chooseSlot(s,e);
 const form=node('form','','grid');
 const tabs=node('div','','row slots');
 const length=Math.max(e.n,slot+1,...Object.keys(records).map(x=>Number(x)+1));
 for(let i=0;i<length;i++){
  const b=button((i+1)+(records[i]?.skip?' · пропуск':records[i]?' ✓':''),()=>{slot=i;render();});
  b.setAttribute('aria-current',String(i===slot));tabs.append(b);
 }
 const old=records[slot]??{};
 const unit=e.id==='side'?'sec':'reps';
 const kg=input(form,'Вес, кг','kg',old.kg);
 const reps=input(form,unit==='sec'?'Секунды на сторону':'Повторы','reps',old.value,true,'numeric');
 const effort=input(form,'Усилие 1–10','effort',old.effort,true,'numeric');
 const history=lastRows(e.id,sessionKey());
 const prev=history.find(r=>r.i===slot)??history[0];
 const box=section(node('h2',e.name),node('p',e.n+' × '+e.reps+' · старт '+e.weight),node('p',e.rir?'RIR '+e.rir+' · повторы в запасе':'Дополнительное упражнение','muted'),button('Техника',()=>technique(e)),tabs,node('h3','Подход № '+(slot+1)));
 if(prev){
  box.append(node('p','Прошлый подход № '+(prev.i+1)+' · '+(prev.date?dateLabel(prev.date):prev.k)+' · '+describe(prev),'muted'),
   button('Повторить значения',()=>{kg.value=prev.kg??'';reps.value=prev.value??'';effort.value=prev.effort??'';}));
 }else box.append(node('p','Предыдущих подходов пока нет','muted'));
 box.append(form);
 const controls=node('div','','row');
 controls.append(button('Добавить подход',()=>{if(length<20){slot=length;render();}}),button('Пропустить подход',()=>{
  if(slot>=e.n){err('Пропуск доступен для запланированных подходов.');return;}
  (s.sets[e.id]??={})[slot]={skip:true,date:stamp()};persist();advance();
 }));
 box.append(controls);
 form.onsubmit=event=>{
  event.preventDefault();
  if(kg.value&&!validNumber(kg.value,0,999)||!validNumber(reps.value,1,999,true)||!validNumber(effort.value,1,10,true)){err('Укажи корректный вес, повторы или секунды и усилие от 1 до 10.');return;}
  (s.sets[e.id]??={})[slot]={kg:kg.value?numeric(kg.value):'',value:numeric(reps.value),unit,effort:numeric(effort.value),date:stamp()};
  persist();until=Date.now()+e.rest*1000;
  const next=Array.from({length:e.n},(_,i)=>i).find(i=>!s.sets[e.id][i]);
  if(next!==undefined){slot=next;render();focusCard();}else advance();
 };
 action('Сохранить подход',()=>form.requestSubmit());
}
function sessionView() {
 const s=current(), list=order();if(!s){active=null;return today();}
 const complete=list.filter(e=>itemDone(s,e)).length;
 const progress=node('progress');progress.max=list.length;progress.value=complete;
 const top=section(node('h2',names[d]+' · неделя '+w),node('p',s.status+' · '+complete+' из '+list.length+' блоков'),progress);
 const controls=node('div','','row');
 list.forEach((e,i)=>{const b=button((itemDone(s,e)?'✓ ':'')+e.name,()=>{ix=i;slot=-1;render();});b.setAttribute('aria-current',String(i===ix));controls.append(b);});const overview=node('details');overview.append(node('summary','Упражнения и переход к блоку'),controls);top.append(overview);
 showTimer();
 if(ix>=list.length){section(node('h2','Подведи итог'),node('p','Проверь сохранённые подходы и выбери статус тренировки.'));}
 else if(list[ix].id==='run')editRun(s,list[ix]);else editLift(s,list[ix]);
 const end=section(node('h3','Статус тренировки'));
 for(const state of statuses){
  const b=button(state,()=>{s.status=state;s.finished=state==='Начата'?null:stamp();persist();if(state!=='Начата'){active=null;historyKey=sessionKey();tab='history';}render();});
  b.setAttribute('aria-current',String(s.status===state));end.append(b);
 }
 const error=node('p','','run');error.id='error';error.setAttribute('role','alert');end.prepend(error);
}
function nextKey() {
 const all=v2().sessions;
 const ongoing=Object.keys(all).filter(k=>all[k].status==='Начата').sort((a,b)=>all[b].date.localeCompare(all[a].date));
 if(ongoing.length)return ongoing[0];
 const week=Array.from({length:12},(_,i)=>i+1).find(i=>names.some((_,j)=>!all[i+'-'+j]));
 if(!week)return null;
 return week+'-'+names.findIndex((_,j)=>!all[week+'-'+j]);
}
function today() {
 const key=nextKey();
 if(!key){section(node('h2','Цикл завершён'),button('Открыть историю',()=>{tab='history';render();}));return;}
 const [nw,nd]=key.split('-').map(Number);const ongoing=v2().sessions[key];
 section(node('p',ongoing?'Начата':'Ближайшая тренировка','tag'),node('h2',names[nd]+' · неделя '+nw),node('p',workout(nw,nd,ongoing?.deferred).map(e=>e.id==='run'?e.target:e.name).join(' → ')),button(ongoing?'Продолжить занятие':'Начать занятие',()=>{w=nw;d=nd;start();},'primary'));
}
function planView() {
 const select=node('select');select.setAttribute('aria-label','Неделя плана');
 W.forEach((data,i)=>{const o=node('option','Неделя '+(i+1)+' · ≈ '+data[4]+' км');o.value=i+1;select.append(o);});
 select.value=w;select.onchange=()=>{w=Number(select.value);render();};
 section(node('h2','План на 12 недель'),select,node('p',phases[w-1],'muted'));
 names.forEach((name,i)=>{
  const box=section(node('h3',name));
  const list=workout(w,i,v2().sessions[w+'-'+i]?.deferred);
  for(const e of list){
   if(e.id==='run'){box.append(node('p',e.target,'run'),node('p',e.tip,'muted'));continue;}
   box.append(node('p',e.name+' · '+e.n+' × '+e.reps+' · '+e.weight+(e.rir?' · RIR '+e.rir:'')));
  }
  if(w===12&&i===3)box.append(node('p',ready));
  box.append(button(v2().sessions[w+'-'+i]?'Открыть занятие':'Начать занятие',()=>{d=i;start();}));
 });
 section(node('h3','Как прибавлять'),node('p','Сначала добавляй повторы. Когда два занятия подряд все подходы на верхней границе с чистой техникой и минимум 2 RIR, прибавь минимальный вес и вернись к нижней границе. Если две тренировки подряд падают повторы или ноги тяжёлые дольше двух суток, повтори этап или облегчи неделю. Вес гантели указан на одну руку.'),node('p','Разминка перед силовой 5–8 мин и 1–3 пробных подхода. Отдых 2–3 мин в основных движениях, 90–120 сек в остальных, 30–60 сек на пресс.'));
}
function historyView() {
 const data=v2().sessions;
 const select=node('select');select.setAttribute('aria-label','Упражнение в истории');
 for(const [id,label] of [['','Выбрать упражнение'],...Object.entries(EX).map(([id,e])=>[id,e[0]])]){const o=node('option',label);o.value=id;select.append(o);}
 select.value=filter;select.onchange=()=>{filter=select.value;render();};
 section(node('h2','История'),select);
 if(filter){
  const rows=lastRows(filter,'');
  section(...(rows.length?rows.map(r=>node('p',(r.date?dateLabel(r.date):r.k)+' · подход '+(r.i+1)+' · '+describe(r))):[node('p','Записей пока нет')]));
 }
 for(const [key,s] of Object.entries(data).sort((a,b)=>b[1].date.localeCompare(a[1].date))){
  const [week,day]=key.split('-').map(Number);
  const box=section(node('h3',names[day]+' · неделя '+week),node('p',dateLabel(s.date)+' · '+s.status));
  if(s.run)box.append(node('p',s.run.km+' км · '+s.run.time+' · '+pace(s.run.km,s.run.sec)+' · усилие '+s.run.effort+'/10'+(s.run.pulse?' · пульс '+s.run.pulse:''),'run'));
  if(historyKey===key)for(const [id,recs] of Object.entries(s.sets))for(const [i,r] of Object.entries(recs))box.append(node('p',(EX[id]?.[0]??id)+' · № '+(Number(i)+1)+' · '+(r.skip?'пропущен':describe(r))));
  box.append(button(historyKey===key?'Свернуть':'Подходы',()=>{historyKey=historyKey===key?'':key;render();}),button('Открыть занятие',()=>openSession(key)));
 }
 const legacy=Object.keys(journal).filter(k=>/^\d+$/.test(k));
 if(legacy.length){
  const box=section(node('h3','Записи из прежней версии'));
  for(const n of legacy)for(const [j,records] of Object.entries(journal[n])){
   const ids=[['bench','leg','rdl','row','calf','run','side'],['press','chestrow','lateral','run','bug'],['lunge','bridge','incline','lat','seated','ham','run','pallof'],['run','crunch']][j];
   const actual=Object.entries(records).filter(([i,r])=>i==='note'?!!r:r.done||r.a||r.b||r.c);
   if(!actual.length)continue;
   const info=node('details');info.append(node('summary','Неделя '+n+' · '+names[j]));
   for(const [i,r] of actual){info.append(node('p',i==='note'?r:(EX[ids[i]]?.[0]??'Бег')+' · '+[r.done?'выполнено':'',r.a,r.b,r.c].filter(Boolean).join(' · ')));}
   box.append(info);
  }
 }
 section(button('Экспорт JSON',exportJournal),button('Импорт JSON',()=>$('importFile').click()));
}
function render() {
 clearInterval(restJob);$('screen').replaceChildren();$('action').hidden=true;
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===tab)));
 if(tab==='plan')planView();else if(tab==='history')historyView();else if(active)sessionView();else today();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;active=null;render();window.scrollTo(0,0);});
function exportJournal(){
 const a=node('a');const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,journal},null,2)],{type:'application/json'}));a.href=url;a.download='zal-beg-journal.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('importFile').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>500000)throw Error();
  const incoming=validate(JSON.parse(await file.text()));
  const add=incoming.trainingV2?.sessions??{};
  const before=v2().sessions;
  const count=Object.keys(add).length,replace=Object.keys(add).filter(k=>before[k]).length;
  const oldWeeks=Object.keys(incoming).filter(k=>/^\d+$/.test(k));
  const replaceOld=oldWeeks.filter(k=>journal[k]).length;
  if(!confirm('Будет добавлено занятий: '+(count-replace)+', заменено: '+replace+'. Старые недели: '+(oldWeeks.length-replaceOld)+' добавятся, '+replaceOld+' заменятся. Продолжить?'))return;
  for(const week of oldWeeks)journal[week]=incoming[week];
  Object.assign(before,add);persist();render();
 }catch{status('Не удалось прочитать резервную копию.');}finally{event.target.value='';}
};
async function init(){
 try{const cached=JSON.parse(localStorage.getItem(stateKey)||'null');if(cached){({journal,rev,dirty}=cached);}}catch{}
 try{
  const r=await fetch('/api/journal',{cache:'no-store'});if(!r.ok)throw Error();
  const remote=await r.json();
  if(dirty&&rev!==remote.revision){conflict=true;status('Есть несинхронизированные записи, а облако изменилось. Экспортируй локальную копию.');}
  else if(!dirty){({journal,revision:rev}=remote);status('Синхронизировано');local();}
  loaded=true;if(dirty&&!conflict)void push();
 }catch{status('Облако недоступно · данные сохраняются на устройстве');}
 const key=nextKey();if(key&&v2().sessions[key]?.status==='Начата')openSession(key);else render();
}
window.addEventListener('online',()=>{if(!loaded)void init();else void push();});
window.addEventListener('focus',async()=>{
 if(!loaded||dirty||sending||conflict)return;
 try{const r=await fetch('/api/journal',{cache:'no-store'});if(!r.ok)return;const remote=await r.json();if(!dirty&&!sending&&remote.revision!==rev){({journal,revision:rev}=remote);local();render();}}catch{}
});
init();
