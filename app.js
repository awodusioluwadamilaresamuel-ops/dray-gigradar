(()=>{'use strict';
const KEY='dray-gigradar-v1',statuses=['New','Contacted','Replied','Negotiating','Won','Lost'];let leads=[];
try{leads=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(leads))leads=[]}catch{}
const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials=s=>String(s||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const active=l=>['Contacted','Replied','Negotiating'].includes(l.status),open=l=>!['Won','Lost'].includes(l.status),sorted=()=>[...leads].sort((a,b)=>b.updated-a.updated);
const badge=s=>'<span class="badge '+String(s).toLowerCase()+'">'+esc(s)+'</span>';
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2000)}
function blank(a,b){return '<div class="empty"><b>'+a+'</b>'+b+'</div>'}
function row(l){return '<div class="row"><div class="row-left"><div class="logo">'+esc(initials(l.name))+'</div><div style="min-width:0"><div class="name">'+esc(l.name)+'</div><div class="meta">'+esc(l.service)+' · '+esc(l.chain)+'</div></div></div><div class="right">'+badge(l.status)+' <button class="icon-btn" data-edit="'+esc(l.id)+'">Edit</button></div></div>'}
function render(){
 const total=leads.length,act=leads.filter(active).length,earned=leads.filter(l=>l.status==='Won'&&l.payment==='Paid').reduce((s,l)=>s+(+l.value||0),0),pending=leads.filter(l=>l.status==='Won'&&l.payment!=='Paid').reduce((s,l)=>s+(+l.value||0),0),potential=leads.filter(open).reduce((s,l)=>s+(+l.value||0),0),wins=leads.filter(l=>l.status==='Won').length;
 $('sLeads').textContent=total;$('sActive').textContent=act;$('sPotential').textContent=money(potential);$('sEarned').textContent=money(earned);$('sWon').textContent=wins+' gigs won';
 $('bars').innerHTML=statuses.slice(0,5).map(s=>{let n=leads.filter(l=>l.status===s).length;return '<div class="stage">'+s+' <b>'+n+'</b><div class="bar"><span style="width:'+(total?Math.max(n?8:0,n/total*100):0)+'%"></span></div></div>'}).join('');
 $('recent').innerHTML=sorted().slice(0,4).map(row).join('')||blank('Your radar is clear.','Add a project you want to investigate.');
 let f=sorted().filter(l=>open(l)&&l.followup).sort((a,b)=>a.followup.localeCompare(b.followup)).slice(0,3);
 $('followups').innerHTML=f.map(l=>'<div class="row"><div><div class="name">'+esc(l.name)+'</div><div class="meta">Follow up: '+esc(l.followup)+'</div></div><button class="icon-btn" data-edit="'+esc(l.id)+'">Open</button></div>').join('')||blank('No follow-ups scheduled.','Add a date so good leads do not go cold.');
 $('noteText').textContent=!total?'Your first goal is not 100 leads. It is 5 well-researched projects and 5 thoughtful approaches.':!act?'You have leads but no active conversations. Pick the strongest one and make a specific, useful approach.':f.length?'You have follow-ups scheduled. Keep them tied to a real next step.':'You have '+act+' active conversation(s). Give each one a clear next action.';
 const q=($('search').value||'').toLowerCase(),filter=$('filter').value,filtered=sorted().filter(l=>(!filter||l.status===filter)&&[l.name,l.chain,l.contact,l.service,l.gap].join(' ').toLowerCase().includes(q));
 $('leadTable').innerHTML=filtered.map(l=>'<tr><td><b>'+esc(l.name)+'</b><div class="meta">'+esc(l.contact||l.service)+'</div></td><td>'+esc(l.chain)+'</td><td>'+badge(l.status)+'</td><td>'+money(l.value)+'</td><td>'+esc(l.followup||'Not set')+'</td><td><button class="icon-btn" data-edit="'+esc(l.id)+'">Edit</button> <button class="icon-btn" data-delete="'+esc(l.id)+'">×</button></td></tr>').join('');
 $('leadEmpty').hidden=!!filtered.length;
 let conversations=sorted().filter(l=>!['New','Lost'].includes(l.status));
 $('outreachRows').innerHTML=conversations.map(l=>'<div class="row"><div style="min-width:0"><div class="name">'+esc(l.name)+' <span style="color:var(--muted);font-weight:400">'+esc(l.contact)+'</span></div><div class="meta">'+esc(l.next||l.gap||'Add your next action in the lead notes.')+'</div></div><div class="right">'+badge(l.status)+' <button class="icon-btn" data-edit="'+esc(l.id)+'">Update</button></div></div>').join('')||blank('No conversations yet.','Update a lead to Contacted after sending a thoughtful pitch.');
 $('pStats').innerHTML=[['New leads',leads.filter(l=>l.status==='New').length],['In conversation',act],['Won gigs',wins],['Lost / closed',leads.filter(l=>l.status==='Lost').length]].map(a=>'<article class="stat"><label>'+a[0]+'</label><strong>'+a[1]+'</strong></article>').join('');
 $('pipeRows').innerHTML=sorted().map(row).join('')||blank('Your pipeline is empty.','Add a lead to start tracking it.');
 $('iEarned').textContent=money(earned);$('iPending').textContent=money(pending);$('iPipeline').textContent=money(potential);
 let wonRows=sorted().filter(l=>l.status==='Won');
 $('incomeTable').innerHTML=wonRows.map(l=>'<tr><td>'+esc(l.name)+'</td><td>'+badge(l.status)+'</td><td>'+money(l.value)+'</td><td>'+esc(l.payment)+'</td><td><button class="icon-btn" data-edit="'+esc(l.id)+'">Edit</button></td></tr>').join('');
 $('incomeEmpty').hidden=!!wonRows.length;
}
function openModal(l){$('form').reset();$('editId').value=l?.id||'';$('modalTitle').textContent=l?'Update opportunity':'Track an opportunity';
 if(l){for(const [key,id] of Object.entries({name:'name',chain:'chain',contact:'contact',service:'service',status:'status',value:'value',followup:'followup',payment:'payment',gap:'gap',next:'next'}))if(l[key]!==undefined)$(id).value=l[key]}
 $('modal').classList.add('open');setTimeout(()=>$('name').focus(),50)}
function closeModal(){$('modal').classList.remove('open')}
function go(v){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+v));document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$('crumb').textContent=({overview:'Overview',leads:'Project leads',outreach:'Outreach',pipeline:'Gig pipeline',income:'Income'})[v];window.scrollTo(0,0)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(leads))}catch{alert('Could not save data in this browser. Check storage settings.')}render();toast('Saved on this device')}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>go(b.dataset.goto));
['sideAdd','addTop','addList','quickAdd','addPipe'].forEach(id=>$(id).onclick=()=>openModal());
$('close').onclick=$('cancel').onclick=closeModal;$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};document.onkeydown=e=>{if(e.key==='Escape')closeModal()};
$('search').oninput=render;$('filter').onchange=render;
$('form').onsubmit=e=>{e.preventDefault();const id=$('editId').value,old=leads.find(l=>l.id===id);
 const l={id:id||Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:$('name').value.trim(),chain:$('chain').value,contact:$('contact').value.trim(),service:$('service').value,status:$('status').value,value:Math.max(0,Number($('value').value)||0),followup:$('followup').value,payment:$('payment').value,gap:$('gap').value.trim(),next:$('next').value.trim(),created:old?.created||Date.now(),updated:Date.now()};
 leads=old?leads.map(x=>x.id===id?l:x):[l,...leads];closeModal();save()};
document.addEventListener('click',e=>{let b=e.target.closest('[data-edit]');if(b){const l=leads.find(x=>x.id===b.dataset.edit);if(l)openModal(l);return}b=e.target.closest('[data-delete]');if(b){const l=leads.find(x=>x.id===b.dataset.delete);if(l&&confirm('Delete '+l.name+'? This cannot be undone.')){leads=leads.filter(x=>x.id!==l.id);save()}}});
render();
})();