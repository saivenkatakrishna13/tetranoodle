import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// Original procedural ScholarX sculpture. No remote models, textures or HDR downloads.
export function mountAtlas(host,{dark,small,ambient=false,motion,onFallback}){
 const canvas=document.createElement('canvas');
 const context=canvas.getContext('webgl2',{alpha:true,antialias:!small&&!ambient,powerPreference:'low-power'});
 if(!context)return null;
 const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:!small&&!ambient,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,ambient?.65:small?1.15:1.5));
 renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=dark?1.05:.95;
 host.appendChild(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,60);
 camera.position.set(0,.35,10.8);camera.lookAt(0,0,0);
 let environment;
 if(!ambient){const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.7;room.dispose();pmrem.dispose();}
 scene.add(new THREE.HemisphereLight(0xe4ffdf,0x173b29,1.8));
 const key=new THREE.DirectionalLight(0xfff5df,2.6);key.position.set(-3,5,4);scene.add(key);
 const rim=new THREE.DirectionalLight(0xb6efbd,1.5);rim.position.set(4,-1,2);scene.add(rim);
 const sculpture=new THREE.Group();scene.add(sculpture);
 const ivory=ambient?new THREE.MeshStandardMaterial({color:0xd5e3c9,metalness:.1,roughness:.65}):new THREE.MeshPhysicalMaterial({color:dark?0xd1dec7:0xe7e8da,metalness:.18,roughness:.32,clearcoat:.7,clearcoatRoughness:.16});
 const gold=new THREE.MeshStandardMaterial({color:0xc7aa6d,metalness:.9,roughness:.25});
 const mint=new THREE.MeshStandardMaterial({color:0xaedba0,metalness:.45,roughness:.25});
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.27,ambient?1:small?2:3),ivory);sculpture.add(core);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.28,1)),new THREE.LineBasicMaterial({color:dark?0xc9ddbb:0x41664c,transparent:true,opacity:dark?.25:.2}));sculpture.add(edges);
 // Meridians turn the porcelain core into an abstract atlas rather than a generic orb.
 const lineMaterial=new THREE.MeshStandardMaterial({color:0xc1a164,metalness:.85,roughness:.3});
 for(let i=0;i<4;i++){
  const meridian=new THREE.Mesh(new THREE.TorusGeometry(1.285,.008,5,small?48:96),lineMaterial);
  meridian.rotation.y=i*Math.PI/4;sculpture.add(meridian);
 }
 const equator=new THREE.Mesh(new THREE.TorusGeometry(1.29,.01,5,96),lineMaterial);equator.rotation.x=Math.PI/2;sculpture.add(equator);
 const rings=[];
 for(let i=0;i<3;i++){
  const group=new THREE.Group();group.rotation.set(.65+i*.53,.2+i*.6,.3-i*.45);
  const radius=1.82+i*.37;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,i===0?.022:.009,6,small?72:144),i===0?gold:mint);group.add(ring);
  const node=new THREE.Mesh(new THREE.SphereGeometry(i===0?.12:.075,small?12:24,12),i===1?ivory:gold);node.position.x=radius;group.add(node);
  sculpture.add(group);rings.push(group);
 }
 // Five luminous destinations echo the five specialists without competing with the form.
 for(let i=0;i<5;i++){
  const angle=i*Math.PI*.4+.2,radius=2.65;
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(i%2?.1:.075),i%2?mint:gold);
  gem.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius*.72,Math.sin(angle)*.7);gem.rotation.z=angle;sculpture.add(gem);
 }
 function paperPlane(x,y,z,rotation,scale){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.45,0,0,.5,.04,0,-.14,.17,.12,-.45,0,0,-.14,.17,.12,-.28,.02,.25,-.28,.02,.25,-.14,.17,.12,.5,.04,0],3));geometry.computeVertexNormals();
  const material=ivory.clone();material.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.set(.1,.1,rotation);mesh.scale.setScalar(scale);sculpture.add(mesh);
 }
 paperPlane(1.9,1.65,.55,-.3,1.2);paperPlane(-2,-1.25,1,.4,.8);
 const starGeometry=new THREE.BufferGeometry(),positions=[];
 let seed=314159;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 for(let i=0;i<(small?26:80);i++)positions.push((random()-.5)*12,(random()-.5)*8,-1-random()*5);
 starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:dark?0xcde9ac:0x507346,size:small?.025:.02,transparent:true,opacity:dark?.45:.3}));scene.add(stars);
 let frame=0,last=0,elapsed=0,turnX=0,turnY=0,visible=true,disposed=false;
 const interval=1000/(ambient?12:small?24:30);
 function draw(now=performance.now()){
  frame=0;if(disposed||!visible||document.hidden)return;
  if(now-last>=interval){
   const dt=Math.min((now-last)/1000,.05);last=now;
   if(!motion.current.paused)elapsed+=dt;
   const easing=1-Math.exp(-dt*12);
   turnX=motion.current.paused?motion.current.x:THREE.MathUtils.lerp(turnX,motion.current.x,easing);
   turnY=motion.current.paused?motion.current.y:THREE.MathUtils.lerp(turnY,motion.current.y,easing);
   sculpture.rotation.set(.14+turnX,elapsed*.075+turnY,-.13);
   sculpture.position.y=Math.sin(elapsed*.4)*.07;
   rings.forEach((group,i)=>{group.rotation.z=(i*.35)+elapsed*(i%2?-.025:.035);});
   stars.rotation.z=elapsed*.006;
   canvas.dataset.rotation=`${motion.current.x.toFixed(2)},${motion.current.y.toFixed(2)}`;
   renderer.render(scene,camera);
  }
  if(!motion.current.paused)frame=requestAnimationFrame(draw);
 }
 function redraw(){if(disposed)return;last=-Infinity;if(!frame)frame=requestAnimationFrame(draw);}
 function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);sculpture.scale.setScalar(width<350?.87:1);redraw();}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)redraw();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(host);
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else redraw();};document.addEventListener('visibilitychange',visibility);
 const lost=event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;visible=false;onFallback();};canvas.addEventListener('webglcontextlost',lost);
 host.addEventListener('atlas-redraw',redraw);resize();
 return()=>{
  disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);host.removeEventListener('atlas-redraw',redraw);
  const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
 };
}
