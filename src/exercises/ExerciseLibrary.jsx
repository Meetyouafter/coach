import {useEffect,useRef,useState} from 'react';
import {Activity,ArrowLeft,ArrowRight,BicepsFlexed,Dumbbell,Footprints,HeartPulse,LoaderCircle,Search,SlidersHorizontal,StretchHorizontal,X} from 'lucide-react';
import {categories,equipmentLabels,bodyPartLabel} from '../../shared/exercise-catalog.js';
import {ErrorNotice} from '../components/ErrorNotice.jsx';
import {loadExercises} from './api.js';
import {GifPreview} from './GifPreview.jsx';
import {ExerciseDialog,SourceCredit} from './ExerciseDialog.jsx';

const categoryIcons={chest:Dumbbell,back:StretchHorizontal,shoulders:Dumbbell,arms:BicepsFlexed,legs:Footprints,core:Activity,calves:Footprints,forearms:BicepsFlexed,cardio:HeartPulse,neck:Activity};
const equipmentOptions=['bodyweight','dumbbell','barbell','cable','leverage machine','resistance band','kettlebell','smith machine'];
export function ExerciseLibrary({initialQuery=''}) {
  const [search,setSearch]=useState(initialQuery);
  const [query,setQuery]=useState(initialQuery);
  const [category,setCategory]=useState('');
  const [equipment,setEquipment]=useState('');
  const [items,setItems]=useState([]);
  const [total,setTotal]=useState(0);
  const [cursor,setCursor]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [moreError,setMoreError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [selected,setSelected]=useState(null);
  const generation=useRef(0),moreRequest=useRef(null);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search),350);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    const current=++generation.current;
    const controller=new AbortController();moreRequest.current?.abort();
    setLoading(true);setLoadingMore(false);setItems([]);setError('');setMoreError('');setCursor(null);
    loadExercises({query,category,equipment},controller.signal)
      .then(data=>{if(!controller.signal.aborted&&current===generation.current){setItems(data.items);setTotal(data.total);setCursor(data.nextCursor);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{controller.abort();moreRequest.current?.abort();};
  },[query,category,equipment,refresh]);
  async function more() {
    if(!cursor||loadingMore)return;
    const current=generation.current,controller=new AbortController();moreRequest.current=controller;
    setLoadingMore(true);setMoreError('');
    try{
      const data=await loadExercises({query,category,equipment,after:cursor},controller.signal);
      if(controller.signal.aborted||current!==generation.current)return;
      setItems(old=>{const seen=new Set(old.map(item=>item.id));return [...old,...data.items.filter(item=>!seen.has(item.id))];});
      setTotal(data.total);setCursor(data.nextCursor);
    }catch(e){if(!controller.signal.aborted&&current===generation.current)setMoreError(e.message);}
    finally{if(!controller.signal.aborted&&current===generation.current)setLoadingMore(false);}
  }
  function reset() {setSearch('');setQuery('');setCategory('');setEquipment('');}
  const selectedCategory=categories.find(item=>item.id===category);
  const overview=!category&&!search.trim()&&!equipment;
  return <section className="exercise-library" aria-labelledby="exercise-library-title">
    <div className="catalog-heading"><div><p className="tag">Библиотека движений</p><h2 id="exercise-library-title">Упражнения</h2><p className="muted">Найди упражнение и посмотри, как его выполнять.</p></div><span className="catalog-mark" aria-hidden="true"><Dumbbell size={28} strokeWidth={1.5} /></span></div>
    <div className="catalog-filters">
      <div className="catalog-search"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="exercise-search">Поиск упражнения</label><input id="exercise-search" type="search" placeholder="Жим лёжа, выпады, bench press…" value={search} maxLength={100} onChange={event=>setSearch(event.target.value)} />{search&&<button type="button" onClick={()=>{setSearch('');setQuery('');}} aria-label="Очистить поиск"><X size={16} aria-hidden="true" /></button>}</div>
      <div className="catalog-equipment"><SlidersHorizontal size={16} aria-hidden="true" /><label className="sr-only" htmlFor="exercise-equipment">Оборудование</label><select id="exercise-equipment" value={equipment} onChange={event=>setEquipment(event.target.value)}><option value="">Любое оборудование</option>{equipmentOptions.map(value=><option key={value} value={value}>{equipmentLabels[value]}</option>)}</select></div>
    </div>
    {overview?<div className="category-grid" aria-label="Категории упражнений">{categories.map(item=>{const Icon=categoryIcons[item.id];return <button key={item.id} type="button" className="category-card" onClick={()=>setCategory(item.id)}><span className="category-icon"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={16} className="category-arrow" aria-hidden="true" /></button>;})}</div>:<div className="catalog-category-filter"><button className="catalog-back" type="button" onClick={reset}><ArrowLeft size={16} aria-hidden="true" /> Все категории</button><label className="sr-only" htmlFor="exercise-category">Группа мышц</label><select id="exercise-category" value={category} onChange={event=>setCategory(event.target.value)}><option value="">Все группы мышц</option>{categories.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></div>}
    <div className="catalog-results-heading"><h3>{selectedCategory?.label??(query.trim()?'Результаты поиска':'Все упражнения')}</h3><span className="muted" role="status">{loading?'Загрузка…':error?'':`${items.length} из ${total}`}</span></div>
    {error?<ErrorNotice title="Каталог пока недоступен" message={error} onAction={()=>setRefresh(value=>value+1)} />:loading?<div className="exercise-grid" aria-label="Загрузка упражнений" aria-busy="true">{Array.from({length:6},(_,index)=><div className="exercise-card exercise-skeleton" key={index}><div /><span /><span /></div>)}</div>:!items.length?<div className="catalog-empty"><Search size={30} aria-hidden="true" /><h3>Ничего не нашли</h3><p className="muted">Попробуй другое название или убери фильтры. Поддерживаются и английские названия упражнений.</p><button type="button" onClick={reset}>Сбросить поиск</button></div>:<>
      <div className="exercise-grid">{items.map(item=><article className="exercise-card" key={item.id}><GifPreview src={item.gifUrl} name={item.name} onOpen={()=>setSelected(item)} /><button type="button" className="exercise-card-body" onClick={()=>setSelected(item)}><span className="exercise-card-category">{item.bodyParts.map(bodyPartLabel).join(' · ')}</span><h3>{item.name}</h3><span className="exercise-card-equipment">{item.equipment.map(value=>equipmentLabels[value]??value).join(', ')}</span><span className="exercise-card-open">Техника <ArrowRight size={14} aria-hidden="true" /></span></button></article>)}</div>
      {moreError?<ErrorNotice title="Не удалось загрузить следующую страницу" message={moreError} onAction={more} />:cursor&&<button className="catalog-more" type="button" disabled={loadingMore} onClick={more}>{loadingMore?<><LoaderCircle className="catalog-spinner" size={17} aria-hidden="true" />Загружаем…</>:'Показать ещё'}</button>}
    </>}
    <SourceCredit />
    {selected&&<ExerciseDialog key={selected.id} exercise={selected} onClose={()=>setSelected(null)} />}
  </section>;
}
