import {useEffect,useRef,useState} from 'react';
import {Expand,ImageOff,Pause,Play} from 'lucide-react';

export function GifPreview({src,name,onOpen,large=false}) {
  const [paused,setPaused]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  const [loaded,setLoaded]=useState(false);
  const [failed,setFailed]=useState(false);
  const image=useRef(null),canvas=useRef(null);
  function capture() {
    const img=image.current,target=canvas.current;
    if(!img?.naturalWidth||!target)return;
    target.width=img.naturalWidth;target.height=img.naturalHeight;
    target.getContext('2d')?.drawImage(img,0,0);
  }
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const changed=()=>{if(media.matches){capture();setPaused(true);}};
    media?.addEventListener?.('change',changed);
    return()=>media?.removeEventListener?.('change',changed);
  },[]);
  const unavailable=!src||failed;
  return <div className={'gif-preview'+(large?' gif-preview-large':'')+(paused?' is-paused':'')}>
    {unavailable?<div className="gif-unavailable"><ImageOff size={28} aria-hidden="true" /><span>Превью недоступно</span></div>:<>
      {!loaded&&<div className="gif-loading" aria-hidden="true" />}
      <img ref={image} src={src} alt={'Демонстрация: '+name} width="180" height="180" loading="lazy" decoding="async" onLoad={()=>{if(paused)capture();setLoaded(true);}} onError={()=>setFailed(true)} />
      <canvas ref={canvas} aria-hidden="true" style={{display:paused&&loaded?'block':'none'}} />
    </>}
    {onOpen&&<button type="button" className="gif-open" onClick={onOpen} aria-label={'Открыть технику: '+name}><Expand size={16} aria-hidden="true" /></button>}
    {!unavailable&&loaded&&<button type="button" className="gif-motion" aria-label={paused?'Воспроизвести демонстрацию':'Приостановить демонстрацию'} onClick={()=>{if(!paused)capture();setPaused(value=>!value);}}>{paused?<Play size={14} aria-hidden="true" />:<Pause size={14} aria-hidden="true" />}</button>}
  </div>;
}
