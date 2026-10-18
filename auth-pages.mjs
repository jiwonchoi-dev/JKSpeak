import * as auth from './auth-client.mjs';
import {profileFields,readProfile} from './profile-fields.mjs';
import {validateProfile} from './learning-profile.mjs';

const $=s=>document.querySelector(s);
const kind=document.body.dataset.authPage;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function say(message,error=false){let status=$('#status');if(!status){status=document.createElement('p');status.id='status';status.className='status';status.setAttribute('role','status');$('#main').append(status);}status.textContent=message;status.classList.toggle('error',error);}
function go(file){location.replace(new URL(file,import.meta.url));}
function busy(form,value){form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);form.setAttribute('aria-busy',String(value));}
async function action(form,fn){busy(form,true);say('Please wait…');try{await fn();}catch(error){say(error.message,true);}finally{busy(form,false);}}
function checkPassword(form){const p=form.querySelector('[name=password]'),confirm=form.querySelector('[name=confirmPassword]');if(confirm){confirm.setCustomValidity(confirm.value===p.value?'':'The passwords do not match.');return confirm.reportValidity();}return true;}
function review(profile,email){return `<dl><dt>Account email</dt><dd>${esc(email)}</dd><dt>Your practice</dt><dd>${esc(profile.displayName)} · ${esc(profile.course)}</dd><dt>Starting preferences</dt><dd>${esc(profile.examFormat)} · ${esc(profile.englishLevel)} (self-reported) · ${esc(profile.focus)}</dd><dt>Your rhythm</dt><dd>${profile.preferredMinutes} minutes · ${profile.weeklyGoal} sessions per week</dd><dt>Optional AI personalisation</dt><dd>${profile.aiConsent?'Opted in for future connected features':'Off — no AI personalisation permission'}</dd></dl>`;}

async function init(){
  if(kind==='privacy')return;
  const config=await auth.authConfig();
  if(!config.configured){
    say('Secure account sign-in is not connected yet. Account creation and login are unavailable until the site owner completes the connection.');
    document.querySelectorAll('form input,form select,form textarea,form button').forEach(el=>el.disabled=true);
    return;
  }
  const callback=await auth.consumeCallback();
  if(['splash','welcome','login'].includes(kind)){
    const user=await auth.account();
    if(user){const profile=await auth.profile();go(profile?'app.html':'profile.html');return;}
    if(callback)say('Your email is confirmed. Log in to continue.');
  }
  if(kind==='signup'){
    $('#profile-fields').innerHTML=profileFields();
    const form=$('#signup-form');let step=0;
    function show(value){step=value;document.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==step);document.querySelectorAll('[data-step-label]').forEach(el=>{el.classList.toggle('active',Number(el.dataset.stepLabel)===step);if(Number(el.dataset.stepLabel)===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});$(`[data-step="${step}"] h2`).setAttribute('tabindex','-1');$(`[data-step="${step}"] h2`).focus();}
    function validStep(){
      if(step===0&&!checkPassword(form))return false;
      for(const input of $(`[data-step="${step}"]`).querySelectorAll('input,select,textarea'))if(!input.checkValidity()){input.reportValidity();return false;}
      return true;
    }
    form.querySelector('[name=confirmPassword]').oninput=()=>form.querySelector('[name=confirmPassword]').setCustomValidity('');
    function advance(){if(!validStep())return;try{if(step===1){const profile=validateProfile(readProfile(form));$('#profile-review').innerHTML=review(profile,form.elements.email.value);}show(Math.min(2,step+1));say('');}catch(error){say(error.message,true);}}
    form.querySelectorAll('[data-next]').forEach(button=>button.onclick=advance);
    form.querySelectorAll('[data-back]').forEach(button=>button.onclick=()=>show(Math.max(0,step-1)));
    form.onsubmit=async event=>{
      event.preventDefault();if(step<2){advance();return;}if(!validStep())return;
      for(const field of form.querySelectorAll('input,select,textarea'))if(!field.checkValidity()){show(Number(field.closest('[data-step]').dataset.step));field.reportValidity();return;}
      if(form.elements.password.value!==form.elements.confirmPassword.value){show(0);checkPassword(form);return;}
      const email=form.elements.email.value,password=form.elements.password.value,profile=validateProfile(readProfile(form));
      await action(form,async()=>{const result=await auth.signup(email,password,profile);form.elements.password.value='';form.elements.confirmPassword.value='';
        if(result.signedIn){go('app.html');return;}
        form.hidden=true;say('Check your email to confirm your account, then log in. If this email is already registered, use Log in or password recovery.');const link=document.createElement('a');link.className='btn btn-primary';link.href='./login.html';link.textContent='Go to login →';$('#status').after(link);
      });
    };
  }
  if(kind==='login')$('#login-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget,email=form.elements.email.value,password=form.elements.password.value;action(form,async()=>{await auth.login(email,password);form.elements.password.value='';const profile=await auth.profile();go(profile?'app.html':'profile.html');});};
  if(kind==='profile'){
    const user=await auth.account();if(!user){go('login.html');return;}
    const existing=await auth.profile();$('#profile-fields').innerHTML=profileFields(existing||{});
    $('#profile-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;let input;try{input=validateProfile(readProfile(form));}catch(error){say(error.message,true);return;}action(form,async()=>{await auth.saveProfile(input);go('app.html');});};
  }
  if(kind==='recover')$('#recover-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget,email=form.elements.email.value;action(form,async()=>{await auth.recover(email);say('If a recovery email can be sent, you will receive a link. Check your inbox and spam folder.');});};
  if(kind==='reset'){
    if(!await auth.account()){$('#reset-form').querySelectorAll('input,button').forEach(el=>el.disabled=true);say('Open a valid recovery link from your email first.',true);return;}
    $('#confirmPassword').oninput=()=>$('#confirmPassword').setCustomValidity('');
    $('#reset-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;if(!checkPassword(form))return;const password=form.elements.password.value;action(form,async()=>{await auth.updatePassword(password);form.reset();await auth.logout();go('login.html');});};
  }
  document.querySelectorAll('form [data-auth-bootstrap]').forEach(el=>{el.disabled=false;el.removeAttribute('data-auth-bootstrap');});
}
init().catch(error=>say(error.message,true));
