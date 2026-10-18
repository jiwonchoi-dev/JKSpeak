import {validateProfile} from './learning-profile.mjs';

const sessionKey='jkspeak-auth-session-v1';
let configPromise;
let refreshPromise;
const appURL=name=>new URL(name,import.meta.url).href;

export async function authConfig(){
  if(!configPromise)configPromise=(async()=>{
    const response=await fetch(appURL('auth-config.json'),{cache:'no-store'});
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
  })();
  return configPromise;
}

function readSession(){try{return JSON.parse(sessionStorage.getItem(sessionKey)||'null');}catch{return null;}}
function clearSession(){sessionStorage.removeItem(sessionKey);}
function storeSession(data){
  if(!data.access_token||!data.refresh_token||!data.user?.id)throw new Error('Sign-in could not be completed.');
  const session={access_token:data.access_token,refresh_token:data.refresh_token,user:{id:data.user.id,email:data.user.email},expires_at:Date.now()+Number(data.expires_in||3600)*1000};
  sessionStorage.setItem(sessionKey,JSON.stringify(session));return session;
}

async function request(path,{method='GET',body,token,headers={}}={}){
  const config=await authConfig();
  if(!config.configured)throw new Error('Account sign-in is not connected yet. Please check back after the site owner connects Supabase.');
  let response;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{response=await fetch(config.url+path,{method,signal:controller.signal,headers:{apikey:config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
  catch{throw new Error('Could not reach the account service. Check your connection and try again.');}finally{clearTimeout(timeout);}
  const data=await response.json().catch(()=>null);
  if(!response.ok){const error=new Error(response.status===429?'Too many attempts. Please wait before trying again.':response.status===401?'Your session expired. Please log in again.':'The account service could not complete this request. Please try again.');error.status=response.status;throw error;}
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
  catch(error){if([400,401,422].includes(error.status))throw new Error('Email or password was not accepted. Check your details and confirm your email before logging in.');throw error;}
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

// Tokens are accepted only after the provider validates the user; clear them from the URL immediately.
export async function consumeCallback(){
  const params=new URLSearchParams(location.hash.slice(1));
  const token=params.get('access_token'),refresh=params.get('refresh_token');
  if(params.has('error')||params.has('error_description')){history.replaceState(null,'',location.pathname+location.search);throw new Error('This account link is invalid or expired. Request a new one.');}
  if(!token||!refresh)return false;
  history.replaceState(null,'',location.pathname+location.search);
  const user=await request('/auth/v1/user',{token});
  storeSession({access_token:token,refresh_token:refresh,user,expires_in:params.get('expires_in')||3600});return true;
}

export async function requireAccount(){
  const user=await account();
  if(!user){location.replace(appURL('login.html'));return null;}
  const learning=await profile();
  if(!learning){location.replace(appURL('profile.html'));return null;}
  return {user,profile:learning};
}
