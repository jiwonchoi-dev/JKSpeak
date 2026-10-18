import test from 'node:test';
import assert from 'node:assert/strict';
import {practicePlan, comparison, validQuote, followUpPrompt, weeklySummary} from '../oral-coach.mjs';

test('older sessions without new fields are preserved and do not become assessments',()=>{
  const legacy=[{id:'old',answers:[{text:'Old answer',needsWork:true}]}];
  assert.equal(practicePlan(legacy,'reasoning').skill,'reasoning');
  assert.equal(practicePlan(legacy).count,0);
  assert.equal(comparison(legacy[0],0,legacy),null);
});
test('learning suggestions use explicit practice flags with exact answer evidence only',()=>{
  const answer=(quote,verdict='practise')=>({text:'A specific example supports the claim.',coach:{skill:'reasoning',quote,verdict}});
  const history=[{answers:[answer('A specific example'),answer('invented evidence'),answer('claim','strength')]}];
  assert.equal(practicePlan(history).skill,'reasoning');
  assert.equal(practicePlan(history).count,1);
  assert.equal(practicePlan([{answers:[answer('   ')]}]).count,0);
  assert.equal(practicePlan(Array.from({length:11},(_,i)=>({answers:i===10?[answer('claim')]:[]}))).count,0);
});
test('retry comparison maps selected question to its original index, not its new position',()=>{
  const history=[{id:'parent',answers:[{text:'first'},{text:'second'}]}];
  const retry={parentId:'parent',questions:[{previousIndex:1}],answers:[{text:'revised second'}]};
  assert.deepEqual(comparison(retry,0,history),{before:'second',after:'revised second'});
  assert.equal(comparison(retry,0,[]),null);
});
test('quotations must be real substrings and contain non-whitespace',()=>{
  assert.equal(validQuote('Actual words','Actual'),true);
  assert.equal(validQuote('Actual words','actual'),false);
  assert.equal(validQuote('Actual words',''),false);
});

test('follow-up preserves the actual excerpt and asks an authored skill-specific challenge',()=>{
  const prompt=followUpPrompt('reasoning','  My claim is limited by the sample.  ');
  assert.match(prompt,/“My claim is limited by the sample\.”/);
  assert.match(prompt,/alternative explanation/);
  assert.equal(followUpPrompt('evidence','x'.repeat(300)).match(/x+/)[0].length,240);
});

test('weekly practice counts only completed recent sessions and distinguishes learning actions',()=>{
  const now=new Date(2026,9,18,12);
  const ended=new Date(2026,9,17,12).toISOString();
  const history=[{ended,answers:[{coach:{saved:true}}]}, {ended,parentId:'original'}, {ended,transferFrom:'original'}, {ended:'2020-01-01T00:00:00Z'}, {ended:new Date(2026,9,20).toISOString()}, {created:ended}];
  assert.deepEqual(weeklySummary(history,4,now),{target:4,completed:3,reviewed:true,retried:true,transferred:true});
  assert.equal(weeklySummary([],99,now).target,3);
});
