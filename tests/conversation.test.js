import test from 'node:test';
import assert from 'node:assert/strict';
import {focusedReply} from '../server/agents.js';
test('only the scheduled single-field follow-up can be asked in ordinary chat',()=>{
 const raw='This app researches programs and funding with five specialists. What is your nationality and when do you want to start?';
 assert.equal(focusedReply(raw,null),'This app researches programs and funding with five specialists.');
 assert.equal(focusedReply(raw,'Which intake are you aiming for?'),'This app researches programs and funding with five specialists.\n\nWhich intake are you aiming for?');
});

test('a question mark inside an official URL does not delete the cited sentence', () => {
  const raw = 'Details are at [the programme page](https://example.edu/apply?id=3). Which intake do you want?';
  const out = focusedReply(raw, null);
  assert.match(out, /https:\/\/example\.edu\/apply\?id=3/);
  assert.doesNotMatch(out, /Which intake/);
});
