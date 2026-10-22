import React from 'react';
import {intakeTerms,gradeScales,fundingNeeds} from '../shared/profile-options';
export default function ProfileFieldInput({name,...props}){
 const options=name==='intake_term'?intakeTerms:name==='cgpa_scale'?gradeScales:name==='funding_need'?fundingNeeds:null;
 if(options)return <select name={name} {...props}><option value="">Not specified</option>{options.map(v=><option key={v} value={v}>{name==='cgpa_scale'?(v==='%'?'%':`/${v}`):name==='funding_need'?({none:'None — no funding needed',partial:'Partial funding',full:'Full funding needed'})[v]:v}</option>)}</select>;
 return <input name={name} maxLength={1000} autoComplete={name==='name'?'name':'off'} {...props}/>;
}
