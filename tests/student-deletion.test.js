import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('deletion cancels delayed saves and survives process restarts without retaining student contents',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'scholarx-delete-'));
 const env={...process.env,TETRA_DATA_DIR:directory};
 const id='deleted-student-fixture';
 try{
  execFileSync(process.execPath,['--input-type=module','-e',`
   import {sessionFor,saveSession,record,deleteSession} from './server/store.js';
   const s=sessionFor('${id}');s.profile={name:'Fictional private name'};saveSession(s,true);
   record(s,{type:'message',message:{agent:'you',content:'Fictional private document facts'}});
   deleteSession(s);saveSession(s,true);record(s,{type:'message',message:{content:'late response'}});
   await new Promise(resolve=>setTimeout(resolve,200));
  `],{env});
  await assert.rejects(access(path.join(directory,`${id}.json`)));
  const restored=execFileSync(process.execPath,['--input-type=module','-e',`
   import {sessionFor,deletedStudentIds,listStudents} from './server/store.js';
   let status;try{sessionFor('${id}');}catch(e){status=e.statusCode;}
   console.log(JSON.stringify({status,deleted:deletedStudentIds(),students:listStudents('${id}')}));
  `],{env,encoding:'utf8'});
  const result=JSON.parse(restored);assert.equal(result.status,410);assert.deepEqual(result.deleted,[id]);assert.deepEqual(result.students,[]);
 }finally{await rm(directory,{recursive:true,force:true});}
});
