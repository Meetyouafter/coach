import {useEffect,useRef,useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
import {ErrorNotice} from '../components/ErrorNotice.jsx';
import {GifPreview} from './GifPreview.jsx';
import {loadExercises} from './api.js';
import {bodyPartLabel,equipmentLabels,muscleLabels,matchProgramExercise,programQuery} from '../../shared/exercise-catalog.js';
import {exerciseName} from '../../shared/exercise-names.js';

export function SourceCredit() {
  return <p className="exercise-source">Демонстрации и данные: <a href="https://oss.exercisedb.dev/" target="_blank" rel="noopener noreferrer">ExerciseDB · AscendAPI<ExternalLink size={11} aria-hidden="true" /></a></p>;
}
export function ExerciseDialog({exercise,onClose,onBrowse}) {
  const dialog=useRef(null);
  const catalogItem=Array.isArray(exercise.bodyParts);
  const [remote,setRemote]=useState(catalogItem?exercise:null);
  const [loading,setLoading]=useState(!catalogItem);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const element=dialog.current;element.showModal();
    return()=>element.close();
  },[]);
  useEffect(()=>{
    if(catalogItem)return;
    const controller=new AbortController();setLoading(true);setError('');
    loadExercises({query:programQuery(exercise.id,exercise.query)},controller.signal)
      .then(data=>{if(!controller.signal.aborted)setRemote(matchProgramExercise(exercise.id,data.items));})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[exercise,catalogItem,attempt]);
  return <dialog ref={dialog} className="exercise-dialog" aria-labelledby="exercise-dialog-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
    if(event.target!==event.currentTarget)return;
    const rect=event.currentTarget.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();
  }}>
    <div className="exercise-dialog-heading"><div><p className="tag">Техника упражнения</p><h2 id="exercise-dialog-title">{exerciseName(exercise.name)}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть упражнение"><X size={21} aria-hidden="true" /></button></div>
    {exercise.tip&&<p className="exercise-tip">{exercise.tip}</p>}
    {loading?<div className="exercise-media-loading" role="status">Загружаем демонстрацию…</div>:error?<ErrorNotice title="Не удалось загрузить демонстрацию" message={error} onAction={()=>setAttempt(value=>value+1)} />:remote?<>
      <div className="exercise-detail-grid"><div><GifPreview src={remote.gifUrl} name={exerciseName(exercise.name)} large /><SourceCredit /></div><div className="exercise-details">
        <div className="exercise-tags">{remote.bodyParts.map(part=><span key={part}>{bodyPartLabel(part)}</span>)}{remote.equipment.map(value=><span key={value}>{equipmentLabels[value]??value}</span>)}</div>
        {remote.muscles.length>0&&<div><h3>Основные мышцы</h3><p>{remote.muscles.map(value=>muscleLabels[value]??value).join(', ')}</p></div>}
        {remote.secondaryMuscles.length>0&&<div><h3>Дополнительно</h3><p className="muted">{remote.secondaryMuscles.map(value=>muscleLabels[value]??value).join(', ')}</p></div>}
        {exercise.tip&&<p className="muted exercise-original-name">В каталоге: {exerciseName(remote.name)}</p>}
      </div></div>
      {!exercise.tip&&remote.instructions.length>0&&<div className="exercise-instructions"><h3>Как выполнять <span className="muted">· инструкция источника на английском</span></h3><ol>{remote.instructions.map((line,index)=><li key={index}>{line}</li>)}</ol></div>}
    </>:<div className="exercise-no-match"><p>Для этого варианта пока не нашли подходящую GIF-демонстрацию.</p>{onBrowse&&<button type="button" onClick={onBrowse}>Найти в каталоге</button>}</div>}
    <div className="exercise-dialog-footer"><button type="button" onClick={onClose}>Закрыть</button>{onBrowse&&remote&&<button type="button" onClick={onBrowse}>Все упражнения</button>}</div>
  </dialog>;
}
