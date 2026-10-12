const S = require('../store.js'); let pass=0, fail=0;
const t=(n,c)=>{ if(c){pass++} else {fail++; console.log('FAIL:',n)} };
// URL
t('bare domain', S.normalizeUrl('example.com').value==='https://example.com');
t('keeps path', S.normalizeUrl('https://www.Example.com/docs/').value==='https://www.example.com/docs/'.replace(/\/$/,'') || S.normalizeUrl('https://www.Example.com/docs/').value==='https://www.example.com/docs/');
t('empty ok', S.normalizeUrl('').ok && S.normalizeUrl('').value==='');
t('reject javascript', !S.normalizeUrl('javascript:alert(1)').ok);
t('reject ftp', !S.normalizeUrl('ftp://x.com').ok);
t('reject no tld', !S.normalizeUrl('localhost').ok);
t('reject spaces', !S.normalizeUrl('not a url').ok);
// Handle
t('@name', S.normalizeHandle('@Project').value==='@Project');
t('bare name', S.normalizeHandle('project_1').value==='@project_1');
t('x link', S.normalizeHandle('https://x.com/Proj?s=20').value==='@Proj');
t('twitter link', S.normalizeHandle('twitter.com/Proj').value==='@Proj');
t('reject long', !S.normalizeHandle('thisiswaytoolongforahandle').ok);
t('reject bad chars', !S.normalizeHandle('@bad name!').ok);
// Normalize / V0 migration
const v0=[{id:'abc',name:' Old Lead ',chain:'Solana',contact:'@a',service:'Social media',status:'Negotiating',value:'250',followup:'2026-10-20',payment:'Pending',gap:'g',next:'n',created:1,updated:2}];
const m=S.parseStored(JSON.stringify(v0));
t('v0 loads', !m.damaged && m.leads.length===1);
t('v0 data kept', m.leads[0].id==='abc' && m.leads[0].name==='Old Lead' && m.leads[0].value===250 && m.leads[0].status==='Negotiating' && m.leads[0].followup==='2026-10-20' && m.leads[0].created===1 && m.leads[0].updated===2);
t('v0 new fields default', m.leads[0].website==='' && m.leads[0].xHandle==='');
t('bad status → New', S.normalizeLead({name:'x',status:'Bogus'}).status==='New');
t('bad date dropped', S.normalizeLead({name:'x',followup:'tomorrow'}).followup==='');
t('negative value → 0', S.normalizeLead({name:'x',value:-5}).value===0);
t('damaged JSON flagged', S.parseStored('{oops').damaged===true);
t('non-array flagged', S.parseStored('{"a":1}').damaged===true);
t('empty storage ok', !S.parseStored(null).damaged && S.parseStored(null).leads.length===0);
// Duplicates
const ex=[S.normalizeLead({id:'1',name:'Nova Protocol',chain:'Solana',website:'https://nova.xyz',xHandle:'@nova'}),S.normalizeLead({id:'2',name:'Zed',chain:'Base'})];
t('dup by name+chain (case/space)', !S.validateLead({name:' nova  protocol',chain:'Solana'},ex).ok);
t('same name other chain allowed', S.validateLead({name:'Nova Protocol',chain:'Base'},ex).ok);
t('dup by website (www, path)', !S.validateLead({name:'Different',chain:'TON',website:'www.nova.xyz/about'},ex).ok);
t('dup by handle (link)', !S.validateLead({name:'Other',chain:'TON',xHandle:'x.com/NOVA'},ex).ok);
t('editing self not a dup', S.validateLead({name:'Nova Protocol',chain:'Solana',website:'nova.xyz'},ex,'1').ok);
t('name required', S.validateLead({name:'  '},ex).errors.name);
t('bad url reported', S.validateLead({name:'Q',website:'javascript:1'},ex).errors.website);
t('dup message names original', /Nova Protocol/.test(S.validateLead({name:'nova protocol',chain:'Solana'},ex).errors.name));
// Export / import
const exp=S.buildExport(ex,0); const parsed=S.parseImport(exp);
t('export roundtrip', parsed.ok && parsed.leads.length===2 && parsed.leads[0].name==='Nova Protocol');
t('import bare array', S.parseImport(JSON.stringify(v0)).ok);
t('import garbage', !S.parseImport('nope').ok && !S.parseImport('{"x":1}').ok);
t('import skips nameless', S.parseImport('[{"foo":1},{"name":"A"}]').skippedInvalid===1);
const mg=S.mergeImport(ex,[S.normalizeLead({id:'3',name:'Fresh',chain:'TON'}),S.normalizeLead({id:'4',name:'zed',chain:'Base'}),S.normalizeLead({id:'1',name:'Nova Protocol',chain:'Solana',updated:Date.now()+9999,gap:'newer'})]);
t('merge adds new', mg.added===1);
t('merge skips dup', mg.duplicates===1);
t('merge takes newer same-id', mg.updated===1 && mg.merged.find(l=>l.id==='1').gap==='newer');
t('merge deletes nothing', mg.merged.length===3 && ex.length===2);
t('todayStr format', /^\d{4}-\d{2}-\d{2}$/.test(S.todayStr()) && S.todayStr(new Date(2026,9,5))==='2026-10-05');
t('unsafe website cleared on load', S.normalizeLead({name:'x',website:'javascript:alert(1)'}).website==='');
t('unsafe website cleared on import', S.parseImport('[{"name":"A","website":"javascript:alert(1)","xHandle":"<b>"}]').leads[0].website==='');
t('bad handle cleared on import', S.parseImport('[{"name":"A","xHandle":"<b>"}]').leads[0].xHandle==='');
t('good website kept on import', S.parseImport('[{"name":"A","website":"https://a.io"}]').leads[0].website==='https://a.io');
console.log(`store tests: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
