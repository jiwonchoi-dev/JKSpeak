// Transparent practice scaffolds. These do not grade or analyse speech.
export const formats = {
  oral: {name:'University oral exam', description:'Explain concepts, connect ideas and apply your knowledge.', questions:['Explain one central concept from your course in your own words.','Use a specific example to show how this concept works.','Compare two ideas from your course. Where do they differ?','What is one limitation of this explanation?']},
  viva: {name:'Viva / oral defence', description:'Defend your choices, evidence and limitations.', questions:['What is your main claim, and why does it matter?','Which evidence best supports your claim, and why?','Why did you choose this approach over an alternative?','What is the strongest limitation of your work?']},
  presentation: {name:'Presentation Q&A', description:'Make your message clear and respond to a challenging audience.', questions:['Summarise the main takeaway of your presentation.','What evidence should convince your audience?','How would you respond to a different interpretation?','What should your audience do or explore next?']}
};
export const skills = {
  structure:{name:'Clear structure', prompt:'State your answer first. Explain why, then return to the question.'},
  evidence:{name:'Evidence & examples', prompt:'Make one claim, cite a specific example from your material, and explain the connection.'},
  reasoning:{name:'Critical reasoning', prompt:'Explain your reasoning, consider an alternative, and acknowledge one limitation.'},
  relevance:{name:'Question relevance', prompt:'Identify what the question asks. Answer that point directly before adding detail.'}
};
export function practicePlan(history, fallback='evidence') {
  const counts=Object.fromEntries(Object.keys(skills).map(k=>[k,0]));
  for(const session of history.slice(0,10)) for(const answer of session.answers||[]) {
    const r=answer.coach;
    // Only an explicit self-review with an exact answer quotation is a learning observation.
    if(r?.verdict==='practise' && skills[r.skill] && r.quote?.trim() && answer.text.includes(r.quote)) counts[r.skill]++;
  }
  const focus=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  const selected=counts[focus]?focus:(skills[fallback]?fallback:'evidence');
  return {skill:selected,count:counts[selected],counts};
}
export function comparison(session,index,history) {
  if(!session.parentId)return null;
  const parent=history.find(s=>s.id===session.parentId);
  const previousIndex=session.questions[index]?.previousIndex;
  if(!parent || !Number.isInteger(previousIndex) || !parent.answers[previousIndex])return null;
  return {before:parent.answers[previousIndex].text,after:session.answers[index].text};
}
export function validQuote(text,quote) {return Boolean(quote?.trim() && text.includes(quote));}

export function followUpPrompt(skill, text) {
  const prompts = {
    structure:'Summarise your main point in one sentence, then explain the steps that support it.',
    evidence:'What specific evidence or example supports that point? Explain the connection.',
    reasoning:'What alternative explanation could challenge that point, and how would you respond?',
    relevance:'How does that point directly answer the original question?'
  };
  return `You wrote: “${text.trim().slice(0, 240)}”\n${prompts[skill] || prompts.evidence}`;
}

export function weeklySummary(history, goal=3, now=new Date()) {
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);
  const recent=history.filter(s=>s.ended && new Date(s.ended)>=start && new Date(s.ended)<=now);
  const target=Number.isInteger(Number(goal))&&Number(goal)>=1&&Number(goal)<=7?Number(goal):3;
  return {target,completed:recent.length,
    reviewed:recent.some(s=>s.answers?.some(a=>a.coach?.saved)),
    retried:recent.some(s=>Boolean(s.parentId)),
    transferred:recent.some(s=>Boolean(s.transferFrom))};
}
