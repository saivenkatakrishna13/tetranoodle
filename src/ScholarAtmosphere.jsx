import React,{memo,useEffect,useRef,useState} from 'react';
function useReducedMotion(){
 const[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);
  media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 return reduced;
}

export default memo(function ScholarAtmosphere({dark=false,active=false}){
 const canvas=useRef(null),host=useRef(null),activity=useRef(active);
 const reduced=useReducedMotion();
 const[renderer,setRenderer]=useState('static');
 const saveData=!!navigator.connection?.saveData;
 activity.current=active;
 useEffect(()=>{
  if(reduced||saveData){setRenderer('static');return;}
  const element=canvas.current,context=element?.getContext('2d',{alpha:true});
  if(!context){setRenderer('static');return;}
  setRenderer('canvas');
  let width=1,height=1,pixelRatio=0,frame=0,previous=0,time=0,disposed=false,visible=!document.hidden,inView=true,rendered=0;
  let small=window.innerWidth<=700;
  const particles=Array.from({length:48},(_,i)=>({x:(Math.sin(i*127.1+4)*43758.54)%1,y:(Math.sin(i*269.5+8)*23421.63)%1,depth:.25+(i%7)/9,phase:i*.73}));
  const curves=[
   [[-.12,.72],[.18,.08],[.39,1.08],[1.14,.19]],
   [[-.1,.75],[.2,.1],[.41,1.1],[1.16,.22]],
   [[.28,1.12],[.44,.69],[.54,.12],[1.1,-.09]],
   [[.31,1.14],[.48,.7],[.55,.15],[1.12,-.08]],
   [[-.15,.34],[.29,.67],[.65,-.22],[1.14,.48]],
   [[.18,1.1],[.72,.9],[.55,.38],[1.16,.65]],
  ];
  const point=(curve,t)=>{const u=1-t;return {x:(u*u*u*curve[0][0]+3*u*u*t*curve[1][0]+3*u*t*t*curve[2][0]+t*t*t*curve[3][0])*width,y:(u*u*u*curve[0][1]+3*u*u*t*curve[1][1]+3*u*t*t*curve[2][1]+t*t*t*curve[3][1])*height};};
  function draw(){
   context.clearRect(0,0,width,height);
   const rgb=dark?'198,166,107':'140,106,52',energy=activity.current?1.22:1;
   curves.slice(0,small?4:6).forEach((curve,i)=>{
    const shift=Math.sin(time*.13+i)*5;
    context.save();context.translate(shift,Math.cos(time*.1+i)*4);
    context.beginPath();context.moveTo(curve[0][0]*width,curve[0][1]*height);
    context.bezierCurveTo(curve[1][0]*width,curve[1][1]*height,curve[2][0]*width,curve[2][1]*height,curve[3][0]*width,curve[3][1]*height);
    context.strokeStyle=`rgba(${rgb},${(i%2?.055:.13)*energy})`;context.lineWidth=i%2?.5:.7;context.stroke();
    const travel=(time*.012+i*.173)%1,trail=.05;
    context.beginPath();for(let j=0;j<=14;j++){const p=point(curve,Math.max(0,travel-trail+j/14*trail));j?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y);}
    const p=point(curve,travel),start=point(curve,Math.max(0,travel-trail));
    const light=context.createLinearGradient(start.x,start.y,p.x+.01,p.y+.01);light.addColorStop(0,`rgba(${rgb},0)`);light.addColorStop(1,`rgba(${rgb},${dark?.62:.38})`);
    context.strokeStyle=light;context.lineWidth=1;context.stroke();context.beginPath();context.arc(p.x,p.y,1.15,0,Math.PI*2);context.fillStyle=`rgba(${rgb},.68)`;context.fill();context.restore();
   });
   particles.slice(0,small?22:48).forEach((p,i)=>{
    const x=((Math.abs(p.x)*width+Math.sin(time*.12+p.phase)*16+p.depth*time*1.8)%width+width)%width;
    const y=((Math.abs(p.y)*height-time*(.7+p.depth)+Math.cos(time*.1+p.phase)*9)%height+height)%height;
    const alpha=(.14+.2*(.5+.5*Math.sin(time*.32+p.phase)))*energy;
    context.beginPath();context.arc(x,y,i%11===0?1.4:.45+p.depth*.45,0,Math.PI*2);context.fillStyle=`rgba(${rgb},${alpha})`;context.fill();
   });
   element.dataset.frames=String(++rendered);
  }
  function tick(now){
   if(disposed||!visible||!inView)return;
   frame=requestAnimationFrame(tick);
   if(previous&&now-previous<(small?1000/24:1000/30))return;
   const delta=previous?Math.min((now-previous)/1000,.1):0;previous=now;time+=delta;draw();
  }
  function start(){cancelAnimationFrame(frame);previous=0;if(visible&&inView)frame=requestAnimationFrame(tick);}
  function resize(){
   const box=host.current.getBoundingClientRect(),nextWidth=Math.max(1,box.width),nextHeight=Math.max(1,box.height);small=window.innerWidth<=700;
   const ratio=Math.min(window.devicePixelRatio||1,small?1:1.4);
   if(nextWidth===width&&nextHeight===height&&ratio===pixelRatio)return;
   width=nextWidth;height=nextHeight;pixelRatio=ratio;
   element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);draw();start();
  }
  const observer=new ResizeObserver(resize);observer.observe(host.current);
  const intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;start();});intersection.observe(host.current);
  const visibility=()=>{visible=!document.hidden;start();};document.addEventListener('visibilitychange',visibility);resize();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);context.clearRect(0,0,width,height);};
 },[dark,reduced,saveData]);
 return <div ref={host} className="scholar-atmosphere ambient-field" aria-hidden="true" data-renderer={renderer} data-motion={reduced||saveData?'still':'active'} data-research={active?'active':'idle'}>
  <svg className="ambient-static" viewBox="0 0 1000 800" preserveAspectRatio="none"><path d="M-90 650C180 40 390 960 1120 150M280 890C440 560 540 90 1120-70M-100 270C300 520 650-180 1120 380"/><g>{Array.from({length:22},(_,i)=><circle key={i} cx={(i*157+43)%1000} cy={(i*293+19)%800} r={i%4===0?1.7:.8}/>)}</g></svg>
  {!reduced&&!saveData&&<canvas ref={canvas}/>}
 </div>;
});
