import React,{memo,useEffect,useRef,useState} from 'react';
import {Pause,Play,RotateCcw,MoveUpRight} from 'lucide-react';

const preference='scholarx.motion.paused';
const initialPause=()=>{try{return localStorage.getItem(preference)==='true';}catch{return false;}};
function useMedia(query){
 const[value,setValue]=useState(()=>matchMedia(query).matches);
 useEffect(()=>{const media=matchMedia(query),change=()=>setValue(media.matches);media.addEventListener('change',change);change();return()=>media.removeEventListener('change',change);},[query]);
 return value;
}
export default memo(function ScholarAtmosphere({dark=false,interactive=false}){
 const host=useRef(null),motion=useRef({paused:initialPause(),x:0,y:0}),drag=useRef(null);
 const[paused,setPaused]=useState(initialPause),[renderer,setRenderer]=useState('loading');
 const reduced=useMedia('(prefers-reduced-motion: reduce)'),small=useMedia('(max-width: 700px)');
 const saveData=!!navigator.connection?.saveData;
 motion.current.paused=paused||reduced;
 useEffect(()=>{
  let cancelled=false,dispose;
  if(reduced||saveData){setRenderer('static');return;}
  setRenderer('loading');
  import('./atlas-scene.js').then(({mountAtlas})=>{
   if(cancelled)return;
   dispose=mountAtlas(host.current,{dark,small,ambient:!interactive,motion,onFallback:()=>{if(!cancelled)setRenderer('static');}});
   setRenderer(dispose?'webgl':'static');
  }).catch(()=>{if(!cancelled)setRenderer('static');});
  return()=>{cancelled=true;dispose?.();};
 },[dark,small,reduced,saveData,interactive]);
 function toggle(){const next=!paused;motion.current.paused=next||reduced;setPaused(next);try{localStorage.setItem(preference,String(next));}catch{}host.current?.dispatchEvent(new Event('atlas-redraw'));}
 function reset(){motion.current.x=0;motion.current.y=0;host.current?.dispatchEvent(new Event('atlas-redraw'));}
 const handlers=interactive?{
  onPointerDown:event=>{if(reduced)return;drag.current={x:event.clientX,y:event.clientY,startX:motion.current.x,startY:motion.current.y};event.currentTarget.setPointerCapture(event.pointerId);},
  onPointerMove:event=>{if(!drag.current)return;motion.current.x=drag.current.startX+(event.clientY-drag.current.y)*.007;motion.current.y=drag.current.startY+(event.clientX-drag.current.x)*.007;host.current?.dispatchEvent(new Event('atlas-redraw'));},
  onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;},onDoubleClick:reset,
  onKeyDown:event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();if(event.key==='Home')reset();else{motion.current[event.key==='ArrowLeft'||event.key==='ArrowRight'?'y':'x']+=event.key==='ArrowLeft'||event.key==='ArrowUp'?-.2:.2;host.current?.dispatchEvent(new Event('atlas-redraw'));}},
 }:{};
 return <div className={`scholar-atmosphere ${interactive?'interactive-atlas':'ambient-atlas'} ${dark?'atlas-dark':''}`} data-renderer={renderer} data-motion={reduced||paused||saveData?'still':'active'}>
  <div className="atlas-aura" aria-hidden="true"/>
  <div className="atlas-fallback" aria-hidden="true"><i/><i/><i/><span>✦</span><b/><b/><b/></div>
  {interactive?<button type="button" className="atlas-stage" aria-label="Interactive scholarship atlas. Drag to rotate; double-click or Home to reset." {...handlers}><div className="atlas-canvas" ref={host} aria-hidden="true"/></button>:<div className="atlas-canvas" ref={host} aria-hidden="true"/>}
  {interactive&&<><span className="atlas-edition"><i/>THE POSSIBILITY ATLAS <span>01 / SCHOLARX</span></span><div className="atlas-controls"><span><MoveUpRight size={12}/>{reduced?'A quieter view, just for you':'Drag to explore · Double-click to reset'}</span><button type="button" onClick={reset} aria-label="Reset 3D view"><RotateCcw size={13}/></button>{!reduced&&!saveData&&<button type="button" onClick={toggle} aria-label={paused?'Resume background animation':'Pause background animation'}>{paused?<Play size={12}/>:<Pause size={12}/>}<span>{paused?'Resume':'Pause'} motion</span></button>}</div></>}
 </div>;
});
