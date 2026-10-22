import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import App from './App';
import useAppearance from './useAppearance';
const Landing=lazy(()=>import('./Landing'));

const isWorkspace = () => /^\/app\/?$/.test(window.location.pathname);
export default function SiteShell() {
  const [inside,setInside] = useState(isWorkspace);
  const [visited,setVisited] = useState(isWorkspace);
  const [landingLight,setLandingLight] = useState(()=>!isWorkspace());
  const appearance = useAppearance({forceLight:!inside&&landingLight});
  const landingAppearance = {...appearance,toggleAppearance:()=>{setLandingLight(false);appearance.toggleAppearance();}};
  const landingScroll = useRef(0);
  const workspaceHost = useRef(null);
  useEffect(() => {
    const pop = () => { const next=isWorkspace(); if(next){setVisited(true);setLandingLight(false);} setInside(next); };
    window.addEventListener('popstate',pop);
    return () => window.removeEventListener('popstate',pop);
  },[]);
  useEffect(() => {
    if(inside) workspaceHost.current?.querySelector('.chat-header button')?.focus({preventScroll:true});
  },[inside]);
  function navigate(event,path) {
    if(event && (event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))return;
    event?.preventDefault();
    const url=new URL(window.location.href);url.pathname=path;url.hash='';
    window.history.pushState(null,'',url);
    if(path==='/app'){setVisited(true);setLandingLight(false);}
    setInside(path==='/app');
  }
  return <>
    {!inside && <Suspense fallback={<div role="status" style={{padding:'30px',color:'var(--scholar-gold)'}}>Opening ScholarX…</div>}><Landing appearanceControls={landingAppearance} onLaunch={event=>navigate(event,'/app')} scrollPosition={landingScroll}/></Suspense>}
    {/* Keep the existing workspace mounted after first launch: drafts, dialogs,
        uploads and active streams survive Home/back navigation. No landing WebGL
        component is mounted while the workspace is visible. */}
    {visited && <div ref={workspaceHost} className="workspace-host" hidden={!inside} inert={!inside}>
      <App appearanceControls={appearance} active={inside} onHome={event=>navigate(event,'/')}/>
    </div>}
  </>;
}
