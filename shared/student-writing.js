(function(root){
 const labels={motivation:'Motivation letter',report:'Last year’s report',proposal:'Funding proposal',business:'Business case development',question:'A question to KETSO'};
 const legacyPrompts={
 report:['Which period and project does this report cover?','What did you plan to do?','What activities actually took place? Give dates where known.','What results can you support with evidence? Identify the evidence and any gaps.','What did you spend? State the currency, period and source for each actual figure. Leave unknown figures blank.','What challenges arose, what did you learn, and what are your next steps?'],
 proposal:['What problem do you want to address, and what evidence supports it?','Who would benefit, and how have you consulted them?','What activities and timeline do you propose?','What outcomes do you hope for, and how would you measure them?','What resources and budget do you need? Label estimates, currencies and assumptions.','What risks and uncertainties remain?','What support are you requesting? Include donor requirements only if you have verified them.']};
 const templateVersion="donor-pdfs-v1";
 const sections={
  "report": [
    [
      "1. Cover page and introduction — project information",
      "Give the exact approved project name in the original proposal language; implementation period; donor/sponsor; grant amount; implementing organisation and local partner; exact locations; NGO contact details and registration number(s). Add short context and identify the lead photograph and caption. Use the upload option for photographs."
    ],
    [
      "1. Cover page and introduction — approved goal and objectives",
      "Copy the overall goal and objectives exactly from the original approved proposal. Do not reconstruct them from memory or improve the wording. Retain English if submitted in English, or Dutch if submitted in Dutch."
    ],
    [
      "2. Results against milestones — results table",
      "For each agreed milestone, enter: Original milestone + activity | Result + Explanation. Copy the exact approved milestone wording, report the actual result, and explain differences. Do not change a milestone to make the result look better. Include relevant technical tables/charts and define the numbers you use."
    ],
    [
      "2. Results against milestones — beneficiaries and examples",
      "Distinguish direct beneficiaries from indirect beneficiaries; do not combine them into an inflated figure. Explain how each number was established. Give a short beneficiary story or quotation and identify 1 or 2 photographs with meaningful captions: who, what, where and when. Use only actual examples and appropriate consent."
    ],
    [
      "3. Longer-term impact, learning and challenges — impact and evidence",
      "What difference is this likely to make beyond the funded activities? Explain measured changes separately from reasonably expected impact. Be careful with attribution: do not present expected impact as achieved. Include relevant dimensions of impact, evidence, simple analysis where useful, and links to further verification. What adaptations or lessons emerged?"
    ],
    [
      "3. Longer-term impact, learning and challenges — photo report",
      "Identify a small selection of photographs showing implementation, participants, physical results, progression and completed outputs, with captions. The template suggests 2 to 3 strong report-quality photographs for small foundation grants; retain additional lower-quality evidence internally. Attach only photographs suitable for the intended use."
    ],
    [
      "3. Longer-term impact, learning and challenges — gaps and safeguarding",
      "For each significant challenge or unfinished commitment, explain: What was planned → what happened → why → what will happen now → who will cover it. Where relevant, cover child safeguarding, vulnerable participant protection, informed consent, safe photography and safeguarding incidents. A separate compliance report is only needed if the donor requires one. Do not include identifying sensitive incident details in work intended for publication."
    ],
    [
      "4. Conclusion, sustainability and next steps — overall assessment",
      "Was the project successful overall, and what happens now? State the most significant achievement, major unfinished issue and realistic next steps without repeating the results chapter. Explain what you would like funded next year and why, distinguishing it from what can continue without new funding."
    ],
    [
      "4. Conclusion, sustainability and next steps — ownership and exit",
      "Who owns each activity now, who maintains infrastructure or trees, and can participants continue independently? State recurring costs and who will pay. Explicitly distinguish activities that are self-sustaining, continue through normal NGO operations, require future external funding, or deliberately end with the grant. What can continue without this donor’s money?"
    ],
    [
      "5. Financial annex — approved budget and expenditure",
      "Use the exact original approved budget structure, or a formally approved revised budget. Do not rename or merge categories or replace them with internal accounting categories. Enter each row as: Approved budget line | Approved budget | Actual expenditure | Variance | Explanation. State currency. Explain significant deviations above 10% and link explanations to implementation. Keep this annex separate from the narrative unless the donor requires otherwise."
    ],
    [
      "5. Financial annex — totals and contributions",
      "State total expenditure, donor contribution, co-financing, NGO/local partner contribution and remaining balance, if any. Reconcile these with the approved-budget rows. Use verified figures only; identify missing records rather than inventing amounts."
    ]
  ],
  "proposal": [
    [
      "Proposal information",
      "Complete: Proposal title (project and location); Donor (donor or funding programme); Applicant organisation (legal name and country); Implementing partner(s) (names and roles); Project location (community, district, country); Duration (start date, end date and total months); Funding request (currency and amount); Contact person (name, role, email and telephone). Replace prompts with project-specific information; distinguish donor priorities, community evidence and assumptions."
    ],
    [
      "Executive summary",
      "Write this last. In about 120 to 180 words, state the problem, who is affected, the proposed response, main result, duration and amount requested, and what will continue after donor funding ends. You can leave this blank and return later."
    ],
    [
      "1. Problem and rationale",
      "Describe the situation before proposing activities. What is happening, where and to whom? Who is affected, about how many, and what differences or barriers matter? What have people said, staff observed, or reliable records shown? Enter evidence rows as: Statement or finding | Evidence/source and date | Known or still to verify. Explain root causes and which can realistically be addressed. Which stated donor priorities does this address? Do not invent donor requirements. Teaching check: distinguish the observed problem, causes and proposed solution."
    ],
    [
      "2. Project design and expected change — goal and results",
      "State the longer-term project goal and intended end-of-project outcome. Complete the theory of change: If we do ___ for ___, then ___ will change because ___. Enter results rows as: Result level | Draft statement | Example measure. Include the outcome (change for people, organisations or environment) and the relevant outputs (direct products/services, with quantity or quality measures)."
    ],
    [
      "2. Project design and expected change — activities, inclusion and scope",
      "List only activities needed for the outputs. Who will participate? How will women, young people or other excluded groups take part and benefit? What will this project include, and what will it not attempt? Teaching check: can every activity be linked to an output and every output to the intended change?"
    ],
    [
      "3. Implementation and organisational capacity — roles and work plan",
      "Enter roles as: Organisation/person | Main responsibility | Relevant capacity or experience. Cover applicant, KETSO/team and local partner as relevant, using evidence of actual capacity. Enter the work plan as: Phase and dates | Key activities | Responsible person | Deliverable. Consider preparation and permissions, training/procurement, main implementation, and follow-up/handover. Teaching check: are roles clear and the plan realistic for actual capacity?"
    ],
    [
      "3. Implementation and organisational capacity — risks and safeguards",
      "Enter: Risk | Likelihood / impact | Practical mitigation. Cover delivery risks, risks to people/land/assets, and continuation risks. Give practical actions, owners and timing. What consent, land agreements, safety measures and personal-data protections are needed? Distinguish actual requirements from assumptions."
    ],
    [
      "4. Results, monitoring and sustainability — monitoring",
      "Enter: Indicator | Baseline | Target | Evidence and timing | Responsible. Cover relevant outcome, output, participation/inclusion and continuation indicators. State sources, frequency or follow-up dates. Use known baselines and clearly identify information still to verify."
    ],
    [
      "4. Results, monitoring and sustainability — handover and learning",
      "What remains with the community (assets, skills, services or income opportunities)? What remains with KETSO (equipment, systems, trained staff, teaching materials or reusable capacity)? Who owns and maintains each asset? What will ongoing operation cost and who pays? How could the investment help KETSO grow? What is the fallback if expected income or participation does not materialise? What will KETSO and the donor learn, and how will that shape future work? Teaching check: sustainability is a funded and assigned plan, not just a promise to continue."
    ],
    [
      "5. Budget and value for money",
      "Enter budget rows as: Budget item | Unit and quantity | Unit cost | Total | Donor request / other source. Consider applicable staff time, training/materials, seeds/seedlings/tools, transport/field work, equipment/infrastructure, monitoring/reporting and other direct costs. Give total project cost and total request. State currency, exchange rate and date, price source, procurement assumptions, overhead/management rate and contingency. Separate confirmed and pending contributions. Explain value for money with a relevant cost per result where possible. State the funding request: amount/currency, donor, project period, main cost areas and main measurable result. Teaching check: can someone reproduce totals, and distinguish assets from recurring costs?"
    ],
    [
      "Final proposal review",
      "Ask a colleague to review from the donor’s point of view. Replace every prompt and confirm all figures and claims. Mark Yes or Revise, with any action, for: Problem (affected people, situation, root causes, evidence); Evidence (facts, community views, assumptions and unverified information distinguishable); Fit (stated donor priorities, no invented requirements); Logic (activities → outputs → outcomes); Feasibility (site, permissions, partners, staff time, timeline); Results (baselines, targets, sources, timing, responsible people); Sustainability (community/KETSO legacy, ownership, maintenance, recurring costs); Budget (matching request, calculations, sources, assumptions); Risk (delivery, safeguarding and continuation owners/actions); Readability (concise summary, clear ask, plain language)."
    ],
    [
      "Teaching reflection",
      "Strongest part: What part is most convincing, and why? Biggest remaining gap: What evidence, decision or cost still needs work? Next action and owner: What will happen next, who will do it, and by when?"
    ]
  ]
};
 const prompts=Object.fromEntries(Object.entries(sections).map(([area,items])=>[area,items.map(([title,prompt])=>title+"\n\n"+prompt)]));
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
 function paragraphs(area,content){
  const items=content.templateVersion===templateVersion?sections[area]?.map(([title])=>title):legacyPrompts[area];
  return [labels[area],content.text||'',...(items||[]).flatMap((title,i)=>[title,content.answers?.[i]||''])];
 }
 function upgradeDraft(area,content){
  if(!sections[area]||content.templateVersion===templateVersion)return content;
  const notes=(legacyPrompts[area]||[]).flatMap((question,i)=>content.answers?.[i]?.trim()?[question,content.answers[i]]:[]);
  return {...content,templateVersion,text:[content.text||'',...(notes.length?['Earlier general-form answers (review and transfer into the template):',...notes]:[])].filter(Boolean).join('\n\n'),answers:[],step:0};
 }
 function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
 function zip(files){
  const enc=new TextEncoder(),parts=[],central=[];let offset=0;
  for(const [name,text]of files){const n=enc.encode(name),b=enc.encode(text),sum=crc(b),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,sum,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);h.set(n,30);
   const c=new Uint8Array(46+n.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint32(16,sum,true);w.setUint32(20,b.length,true);w.setUint32(24,b.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);c.set(n,46);
   parts.push(h,b);central.push(c);offset+=h.length+b.length;
  }
  const length=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/vnd.oasis.opendocument.text'});
 }
 function odt(area,content){return zip([
  ['mimetype','application/vnd.oasis.opendocument.text'],
  ['content.xml',`<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${paragraphs(area,content).flatMap(t=>t.split('\n')).map(t=>`<text:p>${esc(t)}</text:p>`).join('')}</office:text></office:body></office:document-content>`],
  ['META-INF/manifest.xml','<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>']]);}
 const api={labels,prompts,paragraphs,odt,templateVersion,upgradeDraft};root.KetsoWriting=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
