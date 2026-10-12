'use strict';

const KEY = 'dray-gigradar-v1';
const statuses = ['New', 'Researching', 'Qualified', 'Ready to contact', 'Contacted', 'Replied', 'Negotiating', 'Won', 'Lost'];

let leads = [];

// Initialize local storage & migrate V0 records gracefully
try {
  const raw = localStorage.getItem(KEY) || localStorage.getItem('dray-gigradar-v0');
  leads = JSON.parse(raw || '[]');
  if (!Array.isArray(leads)) leads = [];
} catch (e) {
  leads = [];
}

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n) || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();

// Helper status functions
const active = l => ['Contacted', 'Replied', 'Negotiating'].includes(l.status);
const open = l => !['Won', 'Lost'].includes(l.status);
const sorted = () => [...leads].sort((a, b) => (b.updated || 0) - (a.updated || 0));

// Scoring calculation engine (100 point transparent scoring)
function calculateScore(l) {
  let score = 0;
  
  // 1. Signal Strength (Max 30)
  const signalMap = { explicit_hiring: 30, campaign_launch: 25, unanswered_community: 22, low_engagement: 18, recent_funding: 20, general_gap: 12 };
  score += signalMap[l.signalType] || 10;
  
  // 2. Contact Accessibility & Verification (Max 20)
  if (l.contact) {
    score += (l.contactVerified === 'verified') ? 20 : 10;
  }
  
  // 3. Project Legitimacy & Verification (Max 20)
  if (l.website && l.website.startsWith('http')) score += 10;
  if (l.gap && l.gap.length > 15) score += 10;
  
  // 4. Target Service Fit (Max 15)
  if (l.service && l.service !== 'Other') score += 15;
  else score += 5;
  
  // 5. Signal Recency (Max 15)
  const ageDays = (Date.now() - (l.created || Date.now())) / (1000 * 3600 * 24);
  if (ageDays <= 7) score += 15;
  else if (ageDays <= 30) score += 10;
  else score += 5;

  return Math.min(100, Math.max(0, score));
}

function scoreBadge(score) {
  let cls = 'score-low';
  let label = 'Low';
  if (score >= 70) { cls = 'score-high'; label = 'High'; }
  else if (score >= 45) { cls = 'score-med'; label = 'Medium'; }
  return `<span class="badge ${cls}">${score}/100 · ${label}</span>`;
}

function statusBadge(s) {
  const norm = String(s || '').toLowerCase().replace(/\s+/g, '');
  return `<span class="badge ${norm}">${esc(s)}</span>`;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function blank(a, b) {
  return `<div class="empty"><b>${a}</b><p>${b}</p></div>`;
}

function rowHtml(l) {
  const score = calculateScore(l);
  return `
    <div class="row">
      <div class="row-left">
        <div class="logo">${esc(initials(l.name))}</div>
        <div style="min-width:0">
          <div class="name">${esc(l.name)} ${l.website ? `<a href="${esc(l.website)}" target="_blank" style="color:var(--lime);font-size:10px;text-decoration:none;">↗</a>` : ''}</div>
          <div class="meta">${esc(l.service || 'Growth')} · ${esc(l.chain || 'Web3')}</div>
        </div>
      </div>
      <div class="right">
        ${scoreBadge(score)}
        ${statusBadge(l.status)}
        <button class="icon-btn" data-edit="${esc(l.id)}">Edit</button>
      </div>
    </div>
  `;
}

function render() {
  const total = leads.length;
  const highScoreCount = leads.filter(l => calculateScore(l) >= 70).length;
  const actCount = leads.filter(active).length;
  const earned = leads.filter(l => l.status === 'Won' && l.payment === 'Paid').reduce((s, l) => s + (+l.value || 0), 0);
  const pending = leads.filter(l => l.status === 'Won' && l.payment !== 'Paid').reduce((s, l) => s + (+l.value || 0), 0);
  const potential = leads.filter(open).reduce((s, l) => s + (+l.value || 0), 0);
  const wins = leads.filter(l => l.status === 'Won').length;

  // Overview Stats
  $('sLeads').textContent = total;
  $('sHighScore').textContent = highScoreCount;
  $('sActive').textContent = actCount;
  $('sPotential').textContent = money(potential);$('sWon').textContent = `${wins} gigs won`;

  // Pipeline Stage Bar Chart
  const pipelineStages = ['New', 'Researching', 'Qualified', 'Contacted', 'Negotiating'];
  $('bars').innerHTML = pipelineStages.map(s => {
    const count = leads.filter(l => l.status === s).length;
    const pct = total ? Math.max(count ? 8 : 0, (count / total) * 100) : 0;
    return `
      <div class="stage">
        ${s} <b>${count}</b>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }).join('');

  // Top Priority Targets (High Scores First)
  const topRanked = [...leads].sort((a, b) => calculateScore(b) - calculateScore(a)).slice(0, 4);
  $('topTargets').innerHTML = topRanked.map(rowHtml).join('') || blank('No targets tracked.', 'Add a candidate project to begin.');

  // Follow-ups Schedule
  const scheduled = sorted().filter(l => open(l) && l.followup).sort((a, b) => a.followup.localeCompare(b.followup)).slice(0, 3);
  $('followups').innerHTML = scheduled.map(l => `
    <div class="row">
      <div>
        <div class="name">${esc(l.name)}</div>
        <div class="meta">Due: ${esc(l.followup)} · ${esc(l.contact || 'No handle')}</div>
      </div>
      <button class="icon-btn" data-edit="${esc(l.id)}">Open</button>
    </div>
  `).join('') || blank('No follow-ups scheduled.', 'Assign dates to leads to maintain outreach momentum.');

  // Leads Workspace Filter & Search
  const q = ($('search').value || '').toLowerCase();
  const fStatus = $('filterStatus').value;
  const fChain = $('filterChain').value;

  const filtered = sorted().filter(l => {
    const matchStatus = !fStatus || l.status === fStatus;
    const matchChain = !fChain || l.chain === fChain;
    const matchQ = [l.name, l.chain, l.contact, l.service, l.gap, l.category].join(' ').toLowerCase().includes(q);
    return matchStatus && matchChain && matchQ;
  });

  $('leadTable').innerHTML = filtered.map(l => {
    const score = calculateScore(l);
    return `
      <tr>
        <td>
          <b>${esc(l.name)}</b>
          <div class="meta">${l.website ? `<a href="${esc(l.website)}" target="_blank" style="color:var(--muted);">${esc(l.website)}</a>` : esc(l.contact || 'No link')}</div>
        </td>
        <td>${esc(l.chain)} <span style="color:var(--muted)">(${esc(l.category || 'Web3')})</span></td>
        <td>${scoreBadge(score)}</td>
        <td><small>${esc(l.signalType || 'General')}</small></td>
        <td>${statusBadge(l.status)}</td>
        <td>${money(l.value)}</td>
        <td>
          <button class="icon-btn" data-edit="${esc(l.id)}">Edit</button>
          <button class="icon-btn" data-delete="${esc(l.id)}">✕</button>
        </td>
      </tr>
    `;
  }).join('');
  $('leadEmpty').hidden = !!filtered.length;

  // Research Queue View (Incomplete / Unverified leads)
  const queueLeads = sorted().filter(l => !l.contact || l.contactVerified === 'unverified' || !l.gap);
  $('queueRows').innerHTML = queueLeads.map(l => `
    <div class="row">
      <div>
        <div class="name">${esc(l.name)} <span style="color:var(--muted)">(${esc(l.chain)})</span></div>
        <div class="meta" style="color:#f28779;">
          ${!l.contact ? '⚠️ Missing contact handle · ' : ''}
          ${l.contactVerified === 'unverified' ? '⚠️ Contact unverified · ' : ''}
          ${!l.gap ? '⚠️ Needs gap observation' : ''}
        </div>
      </div>
      <button class="icon-btn" data-edit="${esc(l.id)}">Investigate</button>
    </div>
  `).join('') || blank('Research queue clear!', 'All tracked projects have verified contacts and documented gaps.');

  // Outreach Tracker & Generator Options
  const activeConvos = sorted().filter(l => !['New', 'Lost'].includes(l.status));
  $('outreachRows').innerHTML = activeConvos.map(l => `
    <div class="row">
      <div style="min-width:0">
        <div class="name">${esc(l.name)} <span style="color:var(--muted)">${esc(l.contact)}</span></div>
        <div class="meta">${esc(l.next || l.gap || 'Add next step in lead modal')}</div>
      </div>
      <div class="right">
        ${statusBadge(l.status)}
        <button class="icon-btn" data-edit="${esc(l.id)}">Update</button>
      </div>
    </div>
  `).join('') || blank('No active conversations.', 'Move qualified project leads to Contacted after sending your proposal.');

  // Populate Pitch Select Options
  const pitchSelect = $('pitchLeadSelect');
  const currentPitchVal = pitchSelect.value;
  pitchSelect.innerHTML = '<option value="">-- Choose project --</option>' + leads.map(l => `<option value="${esc(l.id)}">${esc(l.name)} (${esc(l.service)})</option>`).join('');
  pitchSelect.value = currentPitchVal;

  // Income Tracker
  $('iEarned').textContent = money(earned);
  $('iPending').textContent = money(pending);$('iPipeline').textContent = money(potential);

  const wonList = sorted().filter(l => l.status === 'Won');
  $('incomeTable').innerHTML = wonList.map(l => `
    <tr>
      <td><b>${esc(l.name)}</b></td>
      <td>${statusBadge(l.status)}</td>
      <td>${money(l.value)}</td>
      <td><span class="badge ${l.payment === 'Paid' ? 'won' : 'contacted'}">${esc(l.payment)}</span></td>
      <td><button class="icon-btn" data-edit="${esc(l.id)}">Edit</button></td>
    </tr>
  `).join('');
  $('incomeEmpty').hidden = !!wonList.length;
}

// Modal open/close handling
function openModal(l) {
  $('form').reset();
  $('editId').value = l?.id \vert{}\vert{} '';$('modalTitle').textContent = l ? 'Update Opportunity Record' : 'Track New Project Opportunity';

  if (l) {
    const fields = ['name', 'website', 'chain', 'category', 'contact', 'contactVerified', 'service', 'signalType', 'status', 'value', 'followup', 'payment', 'gap', 'evidenceUrl', 'next'];
    fields.forEach(f => {
      if ($(f) && l[f] !== undefined)$(f).value = l[f];
    });
  }
  $('modal').classList.add('open');
  setTimeout(() => $('name').focus(), 50);
}

function closeModal() {
  $('modal').classList.remove('open');
}

// View Navigation Switcher
function go(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x.dataset.view === v));
  const titles = { overview: 'Overview', discovery: 'Discovery & Import', leads: 'Project Leads', queue: 'Research Queue', outreach: 'Outreach Generator', income: 'Income Tracker' };
  $('crumb').textContent = titles[v] || 'Workspace';
  window.scrollTo(0, 0);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(leads));
  } catch (e) {
    alert('Failed to save to local browser storage.');
  }
  render();
  toast('Workspace updated');
}

// Mode B: Assisted Parser Function
function processAssistedImport() {
  const text = $('importRawText').value.trim();
  if (!text) {
    alert('Please paste project text or URLs to import.');
    return;
  }

  // Extract domain or handle heuristics
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const handleMatch = text.match(/@[a-zA-Z0-9_]+/i);
  const firstLine = text.split('\n')[0].replace(/https?:\/\/[^\s]+/gi, '').replace(/@[a-zA-Z0-9_]+/gi, '').trim();

  const name = firstLine.slice(0, 40) || 'Imported Candidate';
  const website = urlMatch ? urlMatch[0] : '';
  const contact = handleMatch ? handleMatch[0] : '';
  const category = $('importCategory').value;

  const newLead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    website,
    contact,
    contactVerified: 'unverified',
    chain: 'Solana',
    category,
    service: 'Community Growth',
    signalType: 'general_gap',
    status: 'Researching',
    value: 0,
    gap: text.slice(0, 300),
    created: Date.now(),
    updated: Date.now()
  };

  leads = [newLead, ...leads];
  $('importRawText').value = '';
  save();
  toast('Assisted candidate imported to queue');
  go('queue');
}

// Mode C: Public Feed Simulated Fetcher
function fetchPublicFeed() {
  const source = $('publicSourceSelect').value;
  const container = $('publicFeedResults');
  container.innerHTML = '<p class="form-hint">Fetching candidates from public feed...</p>';

  setTimeout(() => {
    let mockCandidates = [];
    if (source === 'defillama') {
      mockCandidates = [
        { name: 'Aegis Finance', chain: 'Arbitrum / Optimism', category: 'DeFi', website: 'https://aegis.fi', gap: 'New DEX launch without active community moderator presence.' },
        { name: 'SolVault Protocol', chain: 'Solana', category: 'DeFi', website: 'https://solvault.io', gap: 'High TVL growth but official Twitter/X lacks engagement campaigns.' }
      ];
    } else {
      mockCandidates = [
        { name: 'CyberShield Auth', chain: 'Ethereum / EVM', category: 'Infrastructure', website: 'https://cybershield.dev', gap: 'Public GitHub repo indicates upcoming SDK release needing docs and dev outreach.' }
      ];
    }

    container.innerHTML = mockCandidates.map((c, idx) => `
      <div class="feed-card">
        <div>
          <b>${esc(c.name)} (${esc(c.chain)})</b>
          <small>${esc(c.gap)}</small>
        </div>
        <button class="btn" onclick="addFeedCandidate('${esc(c.name)}', '${esc(c.chain)}', '${esc(c.category)}', '${esc(c.website)}', '${esc(c.gap)}')">Import</button>
      </div>
    `).join('');
  }, 600);
}

window.addFeedCandidate = function(name, chain, category, website, gap) {
  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    chain,
    category,
    website,
    contactVerified: 'unverified',
    service: 'Growth Strategy & Campaigns',
    signalType: 'campaign_launch',
    status: 'New',
    value: 0,
    gap,
    created: Date.now(),
    updated: Date.now()
  };
  leads = [lead, ...leads];
  save();
  toast(`Added ${name} to leads`);
};

// Pitch Generator Engine
function generatePitch() {
  const id = $('pitchLeadSelect').value;
  const angle = $('pitchAngle').value;
  const l = leads.find(x => x.id === id);

  if (!l) {
    $('pitchOutput').value = '';
    return;
  }

  let text = `Hey ${l.contact || l.name || 'team'},\n\n`;

  if (angle === 'launch') {
    text += `Noticed the momentum around ${l.name}'s upcoming milestone. `;
    text += `When scaling up campaign pushes on ${l.chain || 'Web3'}, early community onboarding usually determines retention. `;
    text += `I specialize in execution support for ${l.service || 'growth campaigns'}. Would love to share two quick ideas for your launch setup if you're open to it!`;
  } else if (angle === 'mod') {
    text += `I've been following ${l.name} recently and noticed high community activity. `;
    text += `Ensuring 24/7 moderation and active spam protection is crucial at this stage. `;
    text += `I help Web3 teams structure moderation workflows and community security. Let me know if you need an extra set of hands!`;
  } else {
    text += `Was reviewing ${l.name} recently—${l.gap ? l.gap : 'looks like a solid project'}. `;
    text += `I help Web3 protocols streamline ${l.service || 'community engagement'} to boost active participation. `;
    text += `Open to reviewing a concise 3-step audit I put together for ${l.name}?`;
  }

  $('pitchOutput').value = text;
}

// Data Export & Import Handlers
function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(leads, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `gigradar-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (Array.isArray(imported)) {
        leads = imported;
        save();
        toast('Backup restored successfully');
      } else {
        alert('Invalid JSON format.');
      }
    } catch (err) {
      alert('Error parsing JSON file.');
    }
  };
  reader.readAsText(file);
}

// Event Listeners Setup
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
document.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));

['sideAdd', 'addTop', 'addList', 'quickAdd'].forEach(id => {
  if ($(id))$(id).onclick = () => openModal();
});

if ($('btnAssistedTop'))$('btnAssistedTop').onclick = () => go('discovery');
if ($('close'))$('close').onclick = closeModal;
if ($('cancel'))$('cancel').onclick = closeModal;

if ($('modal')) $('modal').onclick = e => { if (e.target ===$('modal')) closeModal(); };
document.onkeydown = e => { if (e.key === 'Escape') closeModal(); };

if ($('search'))$('search').oninput = render;
if ($('filterStatus'))$('filterStatus').onchange = render;
if ($('filterChain'))$('filterChain').onchange = render;

if ($('btnProcessImport'))$('btnProcessImport').onclick = processAssistedImport;
if ($('btnFetchPublicFeed'))$('btnFetchPublicFeed').onclick = fetchPublicFeed;

if ($('pitchLeadSelect'))$('pitchLeadSelect').onchange = generatePitch;
if ($('pitchAngle'))$('pitchAngle').onchange = generatePitch;

if ($('btnCopyPitch'))$('btnCopyPitch').onclick = () => {
  const text = $('pitchOutput').value;
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast('Draft copied to clipboard!');
};

if ($('btnExport'))$('btnExport').onclick = exportJSON;
if ($('btnImportTrigger')) $('btnImportTrigger').onclick = () =>$('fileImport').click();
if ($('fileImport'))$('fileImport').onchange = importJSON;

// Form Submit Handler
$('form').onsubmit = e => {
  e.preventDefault();
  const id = $('editId').value;
  const old = leads.find(l => l.id === id);

  const newRecord = {
    id: id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: $('name').value.trim(),
    website: $('website').value.trim(),
    chain: $('chain').value,
    category: $('category').value,
    contact: $('contact').value.trim(),
    contactVerified: $('contactVerified').value,
    service: $('service').value,
    signalType: $('signalType').value,
    status: $('status').value,
    value: Math.max(0, Number($('value').value) || 0),
    followup: $('followup').value,
    payment: $('payment').value,
    gap: $('gap').value.trim(),
    evidenceUrl: $('evidenceUrl').value.trim(),
    next: $('next').value.trim(),
    created: old?.created || Date.now(),
    updated: Date.now()
  };

  leads = old ? leads.map(x => x.id === id ? newRecord : x) : [newRecord, ...leads];
  closeModal();
  save();
};

// Global Delegated Click Listeners
document.addEventListener('click', e => {
  let b = e.target.closest('[data-edit]');
  if (b) {
    const l = leads.find(x => x.id === b.dataset.edit);
    if (l) openModal(l);
    return;
  }
  b = e.target.closest('[data-delete]');
  if (b) {
    const l = leads.find(x => x.id === b.dataset.delete);
    if (l && confirm(`Delete "${l.name}"? This action cannot be undone.`)) {
      leads = leads.filter(x => x.id !== l.id);
      save();
    }
  }
});

// Initial Render Call
render();
