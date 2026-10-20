import React from 'react';
import {Check,Monitor,Moon,Sun} from 'lucide-react';
import {Modal} from './ui';

const options=[{value:'light',label:'Light',Icon:Sun},{value:'dark',label:'Dark',Icon:Moon},{value:'system',label:'System',Icon:Monitor}];
export default function Appearance({value,onChange,close}){
 function move(event,index){
  let next;
  if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%options.length;
  if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+options.length-1)%options.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=options.length-1;
  if(next===undefined)return;event.preventDefault();onChange(options[next].value);
  event.currentTarget.parentElement.children[next].focus();
 }
 return <Modal title="Appearance" subtitle="A little brighter. A little calmer. Make it yours." close={close}>
  <div className="appearance-options" role="radiogroup" aria-label="Color theme">{options.map(({value:choice,label,Icon},index)=><button key={choice} type="button" role="radio" aria-checked={value===choice} aria-label={label} tabIndex={value===choice?0:-1} className={`appearance-option ${value===choice?'is-selected':''}`} onClick={()=>onChange(choice)} onKeyDown={event=>move(event,index)}>
   <span className={`appearance-preview preview-${choice}`} aria-hidden="true"><span className="preview-header"><i/><i/></span><span className="preview-message"/><span className="preview-message outgoing-preview"/><span className="preview-composer"/></span>
   <span className="appearance-option-label"><Icon size={15}/>{label}<span className="appearance-check" aria-hidden="true">{value===choice&&<Check size={12}/>}</span></span>
  </button>)}</div>
  <p className="appearance-help">{value==='system'?'Matches your device’s appearance and changes with it.':`${value==='dark'?'Dark':'Light'} mode stays on until you change it.`} Your choice is remembered across chats.</p>
  <div className="modal-actions"><button className="primary-button" onClick={close}>Done<Check size={16}/></button></div>
 </Modal>;
}
