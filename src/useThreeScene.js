import {useEffect,useRef,useState} from 'react';
import {AGENTS} from './agents';
import {getAgentSceneSnapshot} from './agentEvents';

// Adapted from the supplied ScholarX HTML. This effect owns every GPU resource,
// DOM tag and listener. Three.js is requested only while Landing is mounted.
export default function useThreeScene({root,canvas,tags,dark,paused}) {
  const [status,setStatus]=useState('loading');
  const settings=useRef({dark,paused}),refresh=useRef(()=>{});
  settings.current={dark,paused};
  useEffect(()=>{
    const host=root.current,cv=canvas.current,tagLayer=tags.current;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let disposed=false,renderer,scene,camera,frameId=0,resizeObserver;
    let cleanupScene=()=>{};
    let reduced=motion.matches || !!navigator.connection?.saveData;
    let width=0,height=0,mx=0,my=0,smoothScroll=0,lastFrame=0,elapsed=0,frames=0;
    let renderFrame=()=>{};
    let ready=false;
    function stop(){cancelAnimationFrame(frameId);frameId=0;lastFrame=0;}
    function loop(now){
      frameId=0;
      if(disposed || document.hidden || settings.current.paused || reduced || !ready)return;
      if(!lastFrame)lastFrame=now;
      const delta=now-lastFrame;
      if(delta>=1000/(width<=800?24:30)){
        elapsed+=Math.min(delta,100)/1000;lastFrame=now;renderFrame(elapsed);
      }
      frameId=requestAnimationFrame(loop);
    }
    function start(){if(!frameId&&!disposed&&!document.hidden&&!settings.current.paused&&!reduced&&ready)frameId=requestAnimationFrame(loop);}
    function resize(){
      if(!renderer)return;
      width=host.clientWidth;height=host.clientHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<=800?1:1.5));
      renderer.setSize(width,height,false);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();
      renderFrame(elapsed);
    }
    function pointer(event){if(!reduced&&event.pointerType==='mouse'){const r=host.getBoundingClientRect();mx=(event.clientX-r.left)/r.width-.5;my=(event.clientY-r.top)/r.height-.5;}}
    function leave(){mx=0;my=0;}
    function scroll(){if(reduced||settings.current.paused)renderFrame(elapsed);}
    function visibility(){if(document.hidden)stop();else {renderFrame(elapsed);start();}}
    function changed(){reduced=motion.matches||!!navigator.connection?.saveData;stop();setStatus(reduced?'static':'webgl');renderFrame(elapsed);start();}
    function lost(event){event.preventDefault();stop();ready=false;tagLayer.replaceChildren();setStatus('fallback');}
    async function initialise(){
      const THREE=await import('./landingThree');
      if(disposed)return;
      const context=cv.getContext('webgl2',{alpha:true,antialias:host.clientWidth>800,powerPreference:'low-power'});
      if(!context){setStatus('fallback');return;}
      renderer=new THREE.WebGLRenderer({canvas:cv,context,alpha:true,antialias:host.clientWidth>800});
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,0,9);
      const gold=new THREE.Color(getComputedStyle(host).getPropertyValue('--gold').trim()||'#c6a66b');
      const group=new THREE.Group();scene.add(group);
      const mesh=(geometry,color,opacity=1,wireframe=false)=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,wireframe,transparent:opacity<1,opacity,depthWrite:opacity===1}));
      const core=mesh(new THREE.IcosahedronGeometry(.95,1),gold,.7,true);
      const glow=mesh(new THREE.SphereGeometry(.52,20,20),gold,dark?.16:.1);
      group.add(core,glow);
      const rings=Array.from({length:3},(_,i)=>{
        const ring=mesh(new THREE.TorusGeometry(1.8+i*.38,.005,6,100),gold,dark?.25:.32);
        ring.rotation.set(Math.PI/2+i*.5,i*.7,0);group.add(ring);return ring;
      });
      const nodes=AGENTS.map((agent,i)=>{
        const color=new THREE.Color(agent.color).lerp(gold,.5);
        const node=mesh(new THREE.OctahedronGeometry(.17,0),color);
        const halo=mesh(new THREE.SphereGeometry(.29,12,12),gold,.12);node.add(halo);group.add(node);
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
        const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:gold,transparent:true,opacity:.28}));group.add(line);
        const packet=mesh(new THREE.SphereGeometry(.035,6,6),gold);group.add(packet);
        const label=document.createElement('div');label.className='landing-tag';label.dataset.agent=agent.id;
        const name=document.createElement('b');name.textContent=agent.name;
        const role=document.createElement('span');role.textContent=` · ${agent.role}`;
        label.append(name,role);tagLayer.appendChild(label);
        return {id:agent.id,node,halo,line,packet,label,r:2.35+i*.21,speed:.24+i*.045,phase:i*Math.PI*2/5,tilt:(i-2)*.25};
      });
      const count=host.clientWidth<=800?260:800,positions=new Float32Array(count*3);
      for(let i=0;i<count;i++){
        const r=6+Math.random()*14,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);
        positions[i*3]=r*Math.sin(phi)*Math.cos(theta);positions[i*3+1]=r*Math.sin(phi)*Math.sin(theta);positions[i*3+2]=r*Math.cos(phi)-4;
      }
      const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const points=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:gold,size:.025,transparent:true,opacity:dark?.45:.3,depthWrite:false}));scene.add(points);
      const vector=new THREE.Vector3(),red=new THREE.Color('#d77967'),green=new THREE.Color('#85bd99');
      function palette(){
        gold.setStyle(getComputedStyle(host).getPropertyValue('--gold').trim()||'#c6a66b');
        core.material.color.copy(gold);glow.material.color.copy(gold);points.material.color.copy(gold);
        points.material.opacity=settings.current.dark?.45:.3;
        rings.forEach(ring=>{ring.material.color.copy(gold);ring.material.opacity=settings.current.dark?.25:.32;});
        nodes.forEach((a,i)=>{a.node.material.color.set(AGENTS[i].color).lerp(gold,.5);a.halo.material.color.copy(gold);a.packet.material.color.copy(gold);});
      }
      renderFrame=t=>{
        if(disposed||!renderer||document.hidden)return;
        const targetScroll=host.scrollTop/Math.max(height,1);
        smoothScroll=reduced||settings.current.paused?targetScroll:smoothScroll+(targetScroll-smoothScroll)*.12;
        const live=getAgentSceneSnapshot();
        const interrupted=live.status==='interrupted',failed=live.failureAt&&Date.now()-live.failureAt<2600;
        core.material.opacity=interrupted?.28:.7;glow.material.opacity=interrupted?.05:settings.current.dark?.16:.1;
        core.rotation.set(t*.12,t*.24,0);glow.scale.setScalar(1+Math.sin(t*1.6)*.045);
        rings.forEach((ring,i)=>{ring.rotation.z=t*(.07+i*.035);});
        const mobile=width<=800;
        group.scale.setScalar(mobile?(width<=360?.4:.46):width<=1100?.65:.82);
        group.position.set((mobile?0:width/height>1.8?3.3:2.75)-Math.min(smoothScroll,2)*(mobile?0:2),mobile?2:0,0);
        group.rotation.set(Math.min(smoothScroll,3)*.22+my*.2,Math.min(smoothScroll,3)*.6+mx*.35,0);
        camera.position.x+=(mx*.7-camera.position.x)*.05;camera.position.y+=(-my*.5-camera.position.y)*.05;
        camera.position.z=9+Math.min(smoothScroll,3)*.9;camera.lookAt(0,0,0);
        scene.updateMatrixWorld();camera.updateMatrixWorld();
        nodes.forEach((a,i)=>{
          const angle=t*a.speed+a.phase;
          a.node.position.set(Math.cos(angle)*a.r,Math.sin(angle*.8+a.tilt*4)*1.1,Math.sin(angle)*a.r);
          a.node.rotation.set(t*.8,t,0);
          const active=live.status==='running'&&live.agent===a.id;
          a.halo.scale.setScalar(active?1.35+Math.sin(t*4)*.2:1);a.halo.material.opacity=active?.3:.12;
          a.line.material.color.copy(failed?red:live.recoveryAt&&Date.now()-live.recoveryAt<2600?green:gold);a.line.material.opacity=failed?.7:active?.6:.28;
          const position=a.line.geometry.attributes.position;position.array.set([0,0,0,a.node.position.x,a.node.position.y,a.node.position.z]);position.needsUpdate=true;
          let k=(t*.45+i*.2)%2;k=k>1?2-k:k;a.packet.position.copy(a.node.position).multiplyScalar(k);
          vector.copy(a.node.position);group.localToWorld(vector);vector.project(camera);
          const x=(vector.x*.5+.5)*width,y=(-vector.y*.5+.5)*height;
          a.label.style.left=`${Math.max(55,Math.min(width-55,x))}px`;a.label.style.top=`${y+(mobile?-16:-24)}px`;
          a.label.style.opacity=String(vector.z>1?0:Math.max(0,1-smoothScroll*1.7));
          a.label.dataset.active=String(active);
        });
        points.rotation.y=t*.014+smoothScroll*.16;
        cv.style.opacity=String(Math.max(.12,1-smoothScroll*.55));
        renderer.render(scene,camera);cv.dataset.frames=String(++frames);
        cv.dataset.agent=live.agent||'';cv.dataset.run=live.status;
      };
      cleanupScene=()=>{
        const geometries=new Set(),materials=new Set();
        scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
        geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());scene.clear();
      };
      ready=true;setStatus(reduced?'static':'webgl');palette();resize();
      refresh.current=()=>{palette();stop();renderFrame(elapsed);start();};
      resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
      host.addEventListener('pointermove',pointer,{passive:true});host.addEventListener('pointerleave',leave);
      host.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',resize);
      document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',changed);cv.addEventListener('webglcontextlost',lost);
      start();
    }
    initialise().catch(()=>{if(!disposed)setStatus('fallback');});
    return()=>{
      disposed=true;refresh.current=()=>{};stop();resizeObserver?.disconnect();
      host.removeEventListener('pointermove',pointer);host.removeEventListener('pointerleave',leave);host.removeEventListener('scroll',scroll);window.removeEventListener('resize',resize);
      document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',changed);cv.removeEventListener('webglcontextlost',lost);
      tagLayer.replaceChildren();cleanupScene();renderer?.dispose();renderer?.forceContextLoss();
    };
  },[root,canvas,tags]);
  useEffect(()=>{refresh.current();},[dark,paused]);
  return status;
}
