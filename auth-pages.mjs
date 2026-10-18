import * as auth from './auth-client.mjs?v=mail-20261018-4';
import {profileQuestions,readProfile,formatNames,focusNames,answerNames,challengeNames} from './profile-fields.mjs?v=mail-20261018-4';
import {validateProfile} from './learning-profile.mjs?v=mail-20261018-4';

const $=selector=>document.querySelector(selector);
const kind=document.body.dataset.authPage;
const pendingEmailKey='jkspeak-pending-email-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function say(message,error=false){let status=$('#status');if(!status){status=document.createElement('p');status.id='status';status.className='status';status.setAttribute('role','status');$('#main').append(status);}status.textContent=message;status.classList.toggle('error',error);}
function go(file){location.replace(new URL(file,import.meta.url));}
function unlock(form){form?.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);}
async function action(form,fn){form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');say('Please wait…');try{await fn();return true;}catch(error){say(error.message,true);return false;}finally{unlock(form);form.setAttribute('aria-busy','false');}}
function pendingEmail(){try{const value=JSON.parse(sessionStorage.getItem(pendingEmailKey)||'null');return value&&Date.now()-value.requestedAt<86400000?value.email:'';}catch{return '';}}
async function signedIn(){const learning=await auth.profile();sessionStorage.removeItem(pendingEmailKey);go(learning?'app.html':'profile.html');}
function validFields(container){for(const input of container.querySelectorAll('input,select,textarea'))if(!input.checkValidity()){const details=input.closest('details');if(details)details.open=true;input.reportValidity();return false;}return true;}

function accountFields(){return `<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required><small>At least 12 characters.</small></div><div class="field"><label for="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></div>`;}
function reviewSection(title,items,step){return `<section class="review-section"><div class="review-heading"><h2>${title}</h2><button type="button" data-edit-step="${step}">Edit</button></div><dl>${items.filter(([,value])=>value!==''&&value!=null).map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>`;}
function renderReview(p,email,signup){const offset=signup?1:0;
 return `<div class="review-stack">${signup?reviewSection('Your account',[['Email',email]],0):''}${reviewSection('About you',[['Name',p.displayName],['Subject',p.course]],offset)}${reviewSection('Your exam',[['Exam',formatNames[p.examFormat]],['Exam date',p.examDate||'Not set']],offset+1)}${reviewSection('Your first focus',[['English level',p.englishLevel==='unsure'?'Not sure yet':p.englishLevel+' · self-reported'],['Focus',focusNames[p.focus]]],offset+2)}${reviewSection('Your practice rhythm',[['Session length',p.preferredMinutes+' minutes'],['Weekly goal',p.weeklyGoal+' sessions'],['Answer method',answerNames[p.answerPreference]],['Time zone',p.timezone]],offset+3)}${reviewSection('Your goals',[['Challenges',p.challenges.map(x=>challengeNames[x]).join(', ')||'None selected'],['Personal goal',p.goal||'Not added']],offset+4)}${reviewSection('Personalisation',[['AI personalisation',p.aiConsent?'Opted in for a future connected feature':'Off — your choice']],offset+5)}</div>${signup?`<label class="check-option review-consent"><input id="privacyAck" name="privacyAck" type="checkbox" required><span>I understand how JKSpeak stores my account and learning profile. <a href="./account-privacy.html" target="_blank" rel="noopener">Read about my data</a>.</span></label><p class="helper">Next: we’ll send a confirmation email. Study materials and recordings are not uploaded during signup.</p>`:''}`;
}

function wizard(existing={},email=''){
 const signup=kind==='signup',form=$(`#${kind}-form`),questions=profileQuestions(existing);
 const steps=[...(signup?[{key:'account',title:'Create your practice space.',description:'Your email and a password keep your account yours.',html:accountFields()}]:[]),...questions,{key:'review',title:'A quick review.',description:'Check the details below. You can edit any answer.',html:'<div id="profile-review"></div>'}];
 const panels=$('#wizard-panels');panels.innerHTML=steps.map((step,index)=>`<section data-step="${index}" data-question="${step.key}" class="question-content" ${index?'hidden':''}>${step.html}</section>`).join('');
 let current=0,returnToReview=false;const last=steps.length-1;
 function show(index){
  current=index;panels.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==index);
  $('#step-label').textContent=`Step ${index+1} of ${steps.length} · ${index===last?'Review':signup&&index===0?'Account':'Learning profile'}`;
  $('#step-progress').max=steps.length;$('#step-progress').value=index+1;
  $('#wizard-title').textContent=steps[index].title;$('#wizard-description').textContent=steps[index].description;
  $('[data-next]').hidden=index===last;$('[data-finish]').hidden=index!==last;
  $('[data-back]').textContent=index?'← Back':signup?'← Welcome':'← Practice';
  if(index===last){
   const p=validateProfile(readProfile(form));$('#profile-review').innerHTML=renderReview(p,signup?form.elements.email.value:email,signup);
   $('#profile-review').querySelectorAll('[data-edit-step]').forEach(button=>button.onclick=()=>{returnToReview=true;show(Number(button.dataset.editStep));});
  }
  $('#wizard-title').focus();window.scrollTo({top:0,behavior:'instant'});
 }
 function validCurrent(){
  if(!validFields(panels.querySelector(`[data-step="${current}"]`)))return false;
  if(signup&&current===0){const confirm=form.elements.confirmPassword;confirm.setCustomValidity(confirm.value===form.elements.password.value?'':'The passwords do not match.');if(!confirm.reportValidity())return false;}
  if(steps[current].key==='routine'){try{new Intl.DateTimeFormat('en',{timeZone:form.elements.timezone.value});}catch{form.elements.timezone.closest('details').open=true;form.elements.timezone.focus();say('Enter a valid time zone, such as Australia/Sydney.',true);return false;}}
  return true;
 }
 function advance(){if(!validCurrent())return;say('');const target=returnToReview?last:Math.min(last,current+1);returnToReview=false;try{show(target);}catch(error){say(error.message,true);}}
 $('[data-next]').onclick=advance;$('[data-back]').onclick=()=>{say('');returnToReview=false;if(!current){go(signup?'welcome.html':'app.html');return;}show(current-1);};
 if(signup){form.elements.confirmPassword.oninput=()=>form.elements.confirmPassword.setCustomValidity('');form.elements.password.oninput=()=>form.elements.confirmPassword.setCustomValidity('');}
 form.onsubmit=async event=>{
  event.preventDefault();if(current!==last){advance();return;}if(!validCurrent())return;
  for(const section of panels.querySelectorAll('[data-step]'))for(const input of section.querySelectorAll('input,select,textarea'))if(!input.checkValidity()){show(Number(section.dataset.step));input.closest('details')?.setAttribute('open','');input.reportValidity();return;}
  let profile;try{profile=validateProfile(readProfile(form));}catch(error){say(error.message,true);return;}
  const accountEmail=signup?form.elements.email.value:'',password=signup?form.elements.password.value:'';
  await action(form,async()=>{
   if(signup){
    const result=await auth.signup(accountEmail,password,profile);form.elements.password.value='';form.elements.confirmPassword.value='';
    if(result.signedIn){await signedIn();return;}
    sessionStorage.setItem(pendingEmailKey,JSON.stringify({email:accountEmail.trim(),requestedAt:Date.now()}));go('confirm-email.html');
   }else{await auth.saveProfile(profile);go('app.html');}
  });
 };
 unlock(form);show(0);
}

function setupLogin(){const form=$('#login-form');unlock(form);form.onsubmit=event=>{event.preventDefault();const email=form.elements.email.value,password=form.elements.password.value;action(form,async()=>{await auth.login(email,password);form.elements.password.value='';await signedIn();});};}
function setupResend(){
 const form=$('#resend-form');if(!form)return;const submit=form.querySelector('button');form.append($('#status'));unlock(form);const email=pendingEmail();if(email){form.elements.email.value=email;$('#pending-email').textContent=email;}
 form.onsubmit=async event=>{event.preventDefault();const value=form.elements.email.value;submit.textContent='Requesting confirmation email…';const success=await action(form,async()=>{await auth.resendConfirmation(value);sessionStorage.setItem(pendingEmailKey,JSON.stringify({email:value.trim(),requestedAt:Date.now()}));say('The account service accepted the request; this does not confirm email delivery. If confirmation is needed, use the latest message. If nothing arrives, contact the site owner to check mail delivery. If already confirmed, try logging in.');});
  $('#status').scrollIntoView({block:'nearest',behavior:'smooth'});
  if(!success)submit.textContent='Send a new confirmation email';
  if(success){const button=form.querySelector('button');button.disabled=true;let seconds=60;const interval=setInterval(()=>{seconds--;button.textContent=seconds?`Request again in ${seconds}s`:'Send a new confirmation email';if(!seconds){clearInterval(interval);button.disabled=false;}},1000);button.textContent='Request again in 60s';}
 };
 if(new URLSearchParams(location.search).get('mode')==='help')$('.email-help').open=true;
}
function setupReset(enabled){const form=$('#reset-form');if(enabled)unlock(form);form.elements.confirmPassword.oninput=()=>form.elements.confirmPassword.setCustomValidity('');form.elements.password.oninput=()=>form.elements.confirmPassword.setCustomValidity('');form.onsubmit=event=>{event.preventDefault();const confirm=form.elements.confirmPassword;confirm.setCustomValidity(confirm.value===form.elements.password.value?'':'The passwords do not match.');if(!confirm.reportValidity())return;const password=form.elements.password.value;action(form,async()=>{await auth.updatePassword(password);form.reset();await auth.logout();go('login.html');});};}
function verificationButton(){
 let button=$('#verify-email-link');if(!button){button=document.createElement('button');button.id='verify-email-link';button.type='button';button.className='btn btn-primary';button.textContent=kind==='reset'?'Confirm password reset':'Confirm my email';$('.flow-heading').after(button);}
 button.hidden=false;if(kind==='confirm'){$('#confirmation-heading').textContent='Confirm your email address.';$('#confirmation-copy').textContent='Select the button below to finish confirmation securely on this device.';$('.flow-actions .btn').classList.remove('btn-primary');}
 button.onclick=async()=>{button.disabled=true;say('Confirming your email…');try{await auth.verifyEmailLink();if(kind==='reset'){button.hidden=true;setupReset(true);say('Link confirmed. Choose your new password.');}else await signedIn();}catch(error){say(error.status===400||error.status===403?'This link may have been used or expired. Try logging in or request a new confirmation email.':error.message,true);button.disabled=false;}};
}

async function init(){
 if(kind==='privacy')return;
 // The public welcome flow must work offline and without a Supabase account.
 if(kind==='splash'||kind==='welcome'){
  try{if(await auth.account())await signedIn();}catch{/* Guests can still continue. */}
  return;
 }
 let config;try{config=await auth.authConfig();}catch(error){say(error.message,true);const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Try connecting again';retry.onclick=()=>location.reload();$('#status').after(retry);return;}
 if(!config.configured){say('Secure account sign-in is not connected yet. Account creation and login are unavailable until the site owner completes the connection.');return;}
 // Bind login/recovery before checking callbacks: stale links or sessions cannot lock out the form.
 if(kind==='login')setupLogin();
 if(kind==='signup')wizard();
 if(kind==='confirm')setupResend();
 if(kind==='recover'){const form=$('#recover-form');unlock(form);form.onsubmit=event=>{event.preventDefault();const email=form.elements.email.value;action(form,async()=>{await auth.recover(email);say('If a recovery email can be sent, you will receive a link. Check your inbox and spam folder.');});};}
 let callback=false,callbackError;
 try{callback=await auth.consumeCallback();}catch(error){callbackError=error;say(error.message,true);if(kind==='confirm')$('.email-help').open=true;}
 if(callback==='needs-confirmation'){verificationButton();if(kind==='reset')setupReset(false);return;}
 if(['splash','welcome','login','confirm'].includes(kind)){
  try{if(await auth.account()){await signedIn();return;}}
  catch(error){if(!callbackError)say(callback===true?'Your link was accepted, but we could not load your profile. Please try logging in below.':'We could not restore your previous session. You can log in again below.',true);}
 }
 if(kind==='profile'){
  try{const user=await auth.account();if(!user){go('login.html');return;}const learning=await auth.profile();wizard(learning||{},user.email);}
  catch(error){say(error.message,true);const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Try loading again';retry.onclick=()=>location.reload();$('#status').after(retry);}
 }
 if(kind==='reset'){let user;try{user=await auth.account();}catch(error){say(error.message,true);}setupReset(Boolean(user));if(!user&&!callbackError)say('Open your latest recovery email link first. You can request another from the login page.',true);}
}
init().catch(error=>say(error.message,true));
// Following another email link in an already-open callback page can change only
// the fragment, without loading the module again.
window.addEventListener('hashchange',()=>{if(['login','confirm','reset'].includes(kind))init().catch(error=>say(error.message,true));});
