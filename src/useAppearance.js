import {useEffect,useLayoutEffect,useState} from 'react';

const storageKey='tetranoodle.appearance.v1';
const choices=['light','dark','system'];
function initialChoice(){
 try{
  const value=localStorage.getItem(storageKey);
  if(choices.includes(value))return value;
  const legacy=JSON.parse(localStorage.getItem('tetranoodle.workspace.v1')||'{}');
  if(typeof legacy.dark==='boolean')return legacy.dark?'dark':'light';
 }catch{/* Use the device setting when storage is unavailable. */}
 return 'system';
}
export default function useAppearance(){
 const[appearance,setAppearance]=useState(initialChoice);
 const[systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
 const dark=appearance==='dark'||appearance==='system'&&systemDark;
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const changed=event=>setSystemDark(event.matches);
  media.addEventListener('change',changed);setSystemDark(media.matches);
  const stored=event=>{if(event.key===storageKey)setAppearance(choices.includes(event.newValue)?event.newValue:'system');};
  window.addEventListener('storage',stored);
  return()=>{media.removeEventListener('change',changed);window.removeEventListener('storage',stored);};
 },[]);
 useLayoutEffect(()=>{
  try{localStorage.setItem(storageKey,appearance);}catch{/* The selection still works for this visit. */}
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#111b21':'#f0f2f5');
 },[appearance,dark]);
 return {appearance,setAppearance,dark,toggleAppearance:()=>setAppearance(dark?'light':'dark')};
}
