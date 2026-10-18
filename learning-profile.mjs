export const profileVersion = 1;
export const levels = ['unsure','A1','A2','B1','B2','C1','C2'];
export const focusSkills = ['structure','evidence','reasoning','relevance'];
export const examFormats = ['oral','viva','presentation'];
export const challenges = ['explaining','examples','followups','organisation','confidence'];

export function validateProfile(input) {
  const text=(key,max)=>String(input[key]??'').trim().slice(0,max);
  const profile={version:profileVersion,displayName:text('displayName',60),course:text('course',120),
    examFormat:text('examFormat',20),englishLevel:text('englishLevel',10),focus:text('focus',20),
    preferredMinutes:Number(input.preferredMinutes),weeklyGoal:Number(input.weeklyGoal),
    answerPreference:text('answerPreference',10),examDate:text('examDate',10),goal:text('goal',500),
    challenges:Array.isArray(input.challenges)?[...new Set(input.challenges.filter(x=>challenges.includes(x)))]:[],
    timezone:text('timezone',80)||'UTC',aiConsent:input.aiConsent===true};
  if(!profile.displayName||!profile.course)throw new Error('Add your preferred name and the subject you will practise.');
  if(!examFormats.includes(profile.examFormat)||!levels.includes(profile.englishLevel)||!focusSkills.includes(profile.focus))throw new Error('Choose your exam format, English level and focus skill.');
  if(![5,10,15,20,30].includes(profile.preferredMinutes)||!Number.isInteger(profile.weeklyGoal)||profile.weeklyGoal<1||profile.weeklyGoal>7)throw new Error('Choose a practice duration and a weekly goal between 1 and 7.');
  if(!['type','speak','both'].includes(profile.answerPreference))throw new Error('Choose how you prefer to answer.');
  if(profile.examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(profile.examDate)||Number.isNaN(Date.parse(profile.examDate))||new Date(profile.examDate).toISOString().slice(0,10)!==profile.examDate))throw new Error('Enter a valid exam date or leave it blank.');
  try{new Intl.DateTimeFormat('en',{timeZone:profile.timezone});}catch{throw new Error('Choose a valid time zone.');}
  return profile;
}

// An explicit allowlist: credentials, account ID and email never enter agent context.
// Returning this object does not transmit it or activate an AI provider.
export function buildAgentContext(input) {
  const p=validateProfile(input);
  if(!p.aiConsent)return null;
  const {displayName,aiConsent,...learning}=p;
  return {purpose:'oral-exam-practice',...learning,englishLevelSource:'self-reported'};
}

export function practiceStorageKey(userId){if(!userId)throw new Error('Account required');return `jkspeak-practice-v2:${userId}`;}
export function audioDatabaseName(userId){if(!userId)throw new Error('Account required');return `jkspeak-audio-v2:${userId}`;}
