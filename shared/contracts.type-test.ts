import type {StudentProfile,Opportunity,Evidence,Match,Draft,RunLog} from './models';
const profile:StudentProfile={degree:'Fictional test input',cgpa:'8.4 / 10'};
const evidence:Evidence={value:'Fixture fact',quote:'Fixture source passage for type checking.',url:'https://example.edu/contract',retrieved_at:'2026-10-21T00:00:00Z',status:'Unverified'};
const opportunity:Opportunity={id:'contract-test',name:'Contract fixture',university:'Fixture',url:evidence.url,claims:{requirements:evidence}};
const match:Match={...opportunity,score:40,score_components:{academic:20}};
const draft:Draft={content:'[Missing: motivation]',opportunityId:match.id,language:'en',createdAt:0,blockedClaims:[],method:'source-constrained'};
const run:RunLog={id:'contract-test',status:'partial',stage:'done',progress:95,startedAt:0};
// @ts-expect-error Academic values stay on their explicit string scale.
const invalidProfile:StudentProfile={cgpa:8.4};
// @ts-expect-error Evidence without a source URL is invalid.
const invalidEvidence:Evidence={value:'Unsupported',quote:'Missing source',retrieved_at:'2026-10-21'};
void [profile,evidence,opportunity,match,draft,run,invalidProfile,invalidEvidence];
