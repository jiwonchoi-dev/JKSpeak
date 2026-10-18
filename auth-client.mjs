import {validateProfile} from './learning-profile.mjs?v=mail-20261018-4';

const sessionKey='jkspeak-auth-session-v1';
let configPromise;
let refreshPromise;
let pendingVerification;
const appURL=name=>new URL(name,import.meta.url).href;

export async function authConfig(){
  if(!configPromise)configPromise=(async()=>{
    const response=await fetch(appURL('auth-config.json'),{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Account configuration could not be loaded. Please try again.');
    const data=await response.json();
    if(!data.url||!data.publishableKey)return {configured:false};
    const url=new URL(data.url);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('The account service configuration needs attention.');
    const key=data.publishableKey;
    let publicKey=key.startsWith('sb_publishable_');
    try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));publicKey=payload.role==='anon';}catch{}
    if(!publicKey)throw new Error('Only a public Supabase publishable/anon key may be used by this app.');
    return {configured:true,url:url.origin,key};
  })().catch(error=>{configPromise=undefined;throw error;});
  return configPromise;
}

function readSession(){try{return JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{return null;}}
function clearSession(){sessionStorage.removeItem(sessionKey);}
function storeSession(data){
  if(!data.access_token||!data.refresh_token||!data.user?.id)throw new Error('Sign-in could not be completed.');
  const session={access_token:data.access_token,refresh_token:data.refresh_token,user:{id:data.user.id,email:data.user.email},expires_at:Date.now()+Number(data.expires_in||3600)*1000};
  sessionStorage.setItem(sessionKey,JSON.stringify(session));return session;
}

// Do not expose provider messages, which can contain personal data or SMTP details.
// Keep actionable, documented mail failures distinct from connection failures.
function providerError(status,code,mailRequest){
  if(code==='email_address_not_authorized')return 'Email delivery is restricted by the project’s mail service. The site owner needs to configure Custom SMTP for other recipients.';
  if(code==='over_email_send_rate_limit')return 'The project’s email sending limit has been reached. Please wait; requesting more emails will not help until the limit resets.';
  if(code==='over_request_rate_limit'||status===429)return 'Too many requests. Please wait before trying again.';
  if(code==='email_address_invalid')return 'Check that your email address is correct.';
  if(mailRequest&&status>=500)return 'The account service could not send the email. The site owner needs to check Auth logs and SMTP settings before you retry.';
  return status===401?'Your session expired. Please log in again.':'The account service could not complete this request. Please try again.';
}

async function request(path,{method='GET',body,token,headers={}}={}){
  const config=await authConfig();
  if(!config.configured)throw new Error('Account sign-in is not connected yet. Please check back after the site owner connects Supabase.');
  let response;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{response=await fetch(config.url+path,{method,signal:controller.signal,headers:{apikey:config.key,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
  catch(cause){throw new Error(cause.name==='AbortError'?'The account service took too long to respond. Please try again.':'Could not reach the account service. Your details have not been cleared; please try again.');}finally{clearTimeout(timeout);}
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const code=data?.error_code||(typeof data?.code==='string'?data.code:'');
    const mailRequest=/^\/auth\/v1\/(signup|resend|recover)(\?|$)/.test(path);
    const safeCode=/^[a-z][a-z0-9_]{0,63}$/.test(code)?code:'';
    const error=new Error(providerError(response.status,code,mailRequest)+(mailRequest?` (HTTP ${response.status}${safeCode?'; '+safeCode:''})`:''));
    error.status=response.status;error.code=code;throw error;
  }
  return data;
}

export async function currentSession(){
  const session=readSession();if(!session)return null;
  if(session.expires_at>Date.now()+60000)return session;
  if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(storeSession).catch(error=>{if([400,401,403].includes(error.status)){clearSession();return null;}throw error;}).finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

export async function login(email,password){
  try{return storeSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:email.trim(),password}}));}
  catch(error){if(error.code==='email_not_confirmed')throw new Error('Confirm your email before logging in. You can request a new confirmation email below.');if([400,401,422].includes(error.status))throw new Error('Email or password was not accepted. Check your details and confirm your email before logging in.');throw error;}
}

export async function signup(email,password,profile){
  const learning=validateProfile(profile);
  const data=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(appURL('login.html')),{method:'POST',body:{email:email.trim(),password,data:{display_name:learning.displayName,learning_profile:learning,profile_consent_version:'2026-10-18'}}});
  if(data?.access_token){storeSession(data);return {signedIn:true};}
  return {signedIn:false};
}

export async function account(){
  const session=await currentSession();if(!session)return null;
  try{const user=await request('/auth/v1/user',{token:session.access_token});session.user={id:user.id,email:user.email};sessionStorage.setItem(sessionKey,JSON.stringify(session));return {id:user.id,email:user.email};}
  catch(error){if([401,403].includes(error.status)){clearSession();return null;}throw error;}
}

export async function profile(){
  const session=await currentSession();if(!session)return null;
  const rows=await request('/rest/v1/learning_profiles?select=learning_profile&id=eq.'+encodeURIComponent(session.user.id),{token:session.access_token});
  return rows?.[0]?.learning_profile?validateProfile(rows[0].learning_profile):null;
}

export async function saveProfile(input){
  const session=await currentSession();if(!session)throw new Error('Log in to save your profile.');
  const learning=validateProfile(input);
  await request('/rest/v1/learning_profiles?on_conflict=id',{method:'POST',token:session.access_token,headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{id:session.user.id,learning_profile:learning}});
  return learning;
}

export async function logout(){
  const session=readSession();clearSession();
  if(session)try{await request('/auth/v1/logout?scope=local',{method:'POST',token:session.access_token});}catch{/* Local sign-out still completes if the provider is unavailable. */}
}

export async function recover(email){await request('/auth/v1/recover?redirect_to='+encodeURIComponent(appURL('reset-password.html')),{method:'POST',body:{email:email.trim()}});}
export async function updatePassword(password){const session=await currentSession();if(!session)throw new Error('Open a valid recovery link first.');await request('/auth/v1/user',{method:'PUT',token:session.access_token,body:{password}});}

// Support existing Supabase implicit links and deliberate token-hash confirmation.
// A used/expired link is recoverable: it must never disable the login form.
export async function consumeCallback(){
  const hash=new URLSearchParams(location.hash.slice(1));
  const query=new URLSearchParams(location.search);
  const read=key=>hash.get(key)||query.get(key);
  const token=read('access_token'),refresh=read('refresh_token'),tokenHash=read('token_hash');
  const hasError=read('error')||read('error_code')||read('error_description');
  if(!token&&!refresh&&!tokenHash&&!hasError&&!query.has('code'))return false;
  const type=read('type')||'email',expiresIn=read('expires_in')||3600;
  for(const key of ['access_token','refresh_token','expires_in','expires_at','token_type','token_hash','type','error','error_code','error_description','code'])query.delete(key);
  history.replaceState(null,'',location.pathname+(query.size?'?'+query.toString():''));
  if(hasError||(!tokenHash&&(!token||!refresh))){const error=new Error('This email link may have been used or expired. Try logging in, or request a fresh confirmation email.');error.code='link_unavailable';throw error;}
  if(tokenHash){
    if(!['email','signup','recovery'].includes(type))throw new Error('This link cannot be used here. Please request a fresh email.');
    pendingVerification={token_hash:tokenHash,type};return 'needs-confirmation';
  }
  try{
    const user=await request('/auth/v1/user',{token});
    storeSession({access_token:token,refresh_token:refresh,user,expires_in:expiresIn});return true;
  }catch(error){
    if([400,401,403].includes(error.status)){const unavailable=new Error('This email link may have been used or expired. Try logging in, or request a fresh confirmation email.');unavailable.code='link_unavailable';throw unavailable;}
    throw error;
  }
}

export async function verifyEmailLink(){
  if(!pendingVerification)throw new Error('Reopen the latest email link to confirm it.');
  const data=await request('/auth/v1/verify',{method:'POST',body:pendingVerification});
  storeSession(data);pendingVerification=null;return true;
}
export async function resendConfirmation(email){
  await request('/auth/v1/resend?redirect_to='+encodeURIComponent(appURL('login.html')),{method:'POST',body:{type:'signup',email:email.trim()}});
}

// Guest access is local-only. It never assumes a Supabase account or uploads practice.
export async function requireAccount({allowGuest=false}={}){
  let user;
  try{user=await account();}catch(error){if(!allowGuest)throw error;user=null;}
  if(!user){
    if(allowGuest)return {guest:true,user:{id:'guest-local'},profile:{
      version:1,displayName:'Guest',course:'My subject',examFormat:'oral',
      englishLevel:'unsure',focus:'evidence',preferredMinutes:10,weeklyGoal:3,
      answerPreference:'both',examDate:'',goal:'',challenges:[],
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',aiConsent:false
    }};
    location.replace(appURL('login.html'));return null;
  }
  const learning=await profile();
  if(!learning){location.replace(appURL('profile.html'));return null;}
  return {guest:false,user,profile:learning};
}
