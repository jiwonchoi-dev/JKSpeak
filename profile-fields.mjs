const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(values,current)=>Object.entries(values).map(([value,label])=>`<option value="${value}" ${String(current)===value?'selected':''}>${label}</option>`).join('');
const field=(name,label,value,extra='',hint='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${esc(value)}" ${extra}>${hint?`<small>${hint}</small>`:''}</div>`;
const select=(name,label,values,current,hint='')=>`<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options(values,current)}</select>${hint?`<small>${hint}</small>`:''}</div>`;
const choices=(name,label,values,current)=>`<fieldset class="choice-group"><legend>${label}</legend>${Object.entries(values).map(([value,text])=>`<label class="choice-option"><input type="radio" name="${name}" value="${value}" ${current===value?'checked':''} required><span>${text}</span></label>`).join('')}</fieldset>`;
export const formatNames={oral:'University oral exam',viva:'Viva / oral defence',presentation:'Presentation Q&A'};
export const focusNames={structure:'Clear structure',evidence:'Evidence & examples',reasoning:'Critical reasoning',relevance:'Question relevance'};
export const answerNames={both:'Speaking and typing',speak:'Speaking with typing available',type:'Typing first'};
export const challengeNames={explaining:'Explaining concepts',examples:'Finding evidence or examples',followups:'Answering follow-up questions',organisation:'Organising an answer',confidence:'Feeling ready to speak'};

export function profileQuestions(p={}){
 return [
  {key:'you',title:'First, a little about you.',description:'Two details to make practice feel relevant.',html:
    field('displayName','What should we call you?',p.displayName,'autocomplete="nickname" maxlength="60" required','A preferred name is enough.')+
    field('course','Your subject or course',p.course,'maxlength="120" placeholder="e.g. Cognitive Psychology" required')},
  {key:'exam',title:'What are you preparing for?',description:'Choose the setting that feels closest to your exam.',html:
    choices('examFormat','Your exam',formatNames,p.examFormat||'oral')+field('examDate','Exam date · optional',p.examDate,'type="date"')},
  {key:'focus',title:'Where would you like to start?',description:'Choose one focus. You can change it as you practise.',html:
    select('englishLevel','Your English level',{unsure:'Not sure yet',A1:'A1 · Beginner',A2:'A2 · Elementary',B1:'B1 · Intermediate',B2:'B2 · Upper intermediate',C1:'C1 · Advanced',C2:'C2 · Proficient'},p.englishLevel||'unsure','Self-reported, never treated as a test score.')+
    choices('focus','Your first focus',focusNames,p.focus||'evidence')},
  {key:'routine',title:'Find a comfortable rhythm.',description:'Start small. These become your practice defaults.',html:
    select('preferredMinutes','Time for one session',{5:'5 minutes',10:'10 minutes',15:'15 minutes',20:'20 minutes',30:'30 minutes'},p.preferredMinutes||10)+
    select('weeklyGoal','Sessions per week',Object.fromEntries([1,2,3,4,5,6,7].map(n=>[n,`${n} session${n===1?'':'s'}`])),p.weeklyGoal||3)+
    select('answerPreference','How would you like to answer?',answerNames,p.answerPreference||'both')+
    `<details class="optional-detail"><summary>Time zone</summary>${field('timezone','Your time zone',p.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC','maxlength="80" required')}</details>`},
  {key:'goals',title:'What could use a little practice?',description:'Optional. Select what feels familiar, or keep going.',html:
    `<fieldset class="choice-group"><legend>What feels challenging?</legend>${Object.entries(challengeNames).map(([value,label])=>`<label class="choice-option"><input type="checkbox" name="challenges" value="${value}" ${p.challenges?.includes(value)?'checked':''}><span>${label}</span></label>`).join('')}</fieldset><div class="field"><label for="goal">Your own goal · optional</label><textarea id="goal" name="goal" maxlength="500" placeholder="One thing I would like to do more clearly…">${esc(p.goal)}</textarea></div>`},
  {key:'privacy',title:'Personalisation, on your terms.',description:'Your profile already sets up your practice. AI is a separate choice.',html:
    `<label class="choice-option consent-option"><input id="aiConsent" name="aiConsent" type="checkbox" ${p.aiConsent?'checked':''}><span>Allow my learning preferences to personalise a future connected AI feature.</span></label><p class="helper">Optional and off by default. No AI service is connected today. You can change this later. Email, password and sign-in tokens are excluded from AI learning context.</p><a class="link" href="./account-privacy.html" target="_blank" rel="noopener">How we use learning data</a>`}
 ];
}
export function profileFields(p={}){return profileQuestions(p).map(q=>q.html).join('');}
export function readProfile(form){const data=new FormData(form);return {...Object.fromEntries(data),challenges:data.getAll('challenges'),aiConsent:data.has('aiConsent')};}
