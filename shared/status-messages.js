export function statusMessageKey(message){
 if(!message||message.agent==='you')return null;
 if(message.profile_summary_key)return `${message.agent}\nprofile:${message.profile_summary_key}`;
 if(!message.status&&!/^(?:The run was interrupted:|We have \d+ reviewed opportunities|I found \d+ candidate opportunities|Your saved findings and their evidence gaps)/.test(message.content||''))return null;
 return `${message.agent}\n${message.statusRunId||''}\n${String(message.content).replace(/\s+/g,' ').trim()}`;
}
export function dedupeStatusMessages(messages){const seen=new Set();return messages.filter(m=>{const key=statusMessageKey(m);if(!key)return true;if(seen.has(key))return false;seen.add(key);return true;});}
