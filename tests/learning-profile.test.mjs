import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile,buildAgentContext,practiceStorageKey,audioDatabaseName} from '../learning-profile.mjs';
import {mergeLegacyPractice} from '../account-data.mjs';
const sample={displayName:'Learner',course:'Psychology',examFormat:'oral',englishLevel:'unsure',focus:'evidence',preferredMinutes:10,weeklyGoal:3,answerPreference:'both',examDate:'',goal:'Explain my reasoning',challenges:['followups'],timezone:'UTC',aiConsent:false};

test('profile validation keeps useful learning data and drops account credentials and unknown fields',()=>{
  const p=validateProfile({...sample,password:'do not store',email:'not-in-profile@example.test',access_token:'never',role:'admin'});
  assert.equal(p.displayName,'Learner');for(const key of ['password','email','access_token','role'])assert.equal(key in p,false);
  assert.throws(()=>validateProfile({...sample,course:' '}));
  assert.throws(()=>validateProfile({...sample,weeklyGoal:99}));
  assert.throws(()=>validateProfile({...sample,examDate:'2026-02-30'}));
});
test('AI context is opt-in and excludes identity and credentials',()=>{
  assert.equal(buildAgentContext(sample),null);
  const context=buildAgentContext({...sample,aiConsent:true,email:'not-in-context@example.test',password:'never'});
  assert.equal(context.course,'Psychology');assert.equal(context.englishLevelSource,'self-reported');
  for(const key of ['displayName','email','password','access_token','refresh_token','userId'])assert.equal(key in context,false);
});
test('account storage and audio namespaces cannot mix between users',()=>{
  assert.notEqual(practiceStorageKey('one'),practiceStorageKey('two'));
  assert.notEqual(audioDatabaseName('one'),audioDatabaseName('two'));
  assert.throws(()=>practiceStorageKey(''));assert.throws(()=>audioDatabaseName(''));
});
test('legacy import adds missing records and preserves existing account records and active practice',()=>{
  const current={history:[{id:'same',answers:['new']}],active:{id:'current-active'},settings:{}};
  const legacy={history:[{id:'same',answers:['old']},{id:'legacy-only'}],active:{id:'old-active'}};
  const merged=mergeLegacyPractice(current,legacy);
  assert.deepEqual(merged.state.history,[{id:'same',answers:['new']},{id:'legacy-only'}]);
  assert.equal(merged.state.active.id,'current-active');assert.deepEqual([...merged.ids],['legacy-only']);
  assert.equal(legacy.history.length,2);
});
