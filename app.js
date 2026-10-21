(() => {
  'use strict';

  const Store = window.GigStore;
  const Sources = window.GigSources;
  const KEY = 'dray-gigradar-v1';                 // same key as V0, so existing data is kept
  const META_KEY = 'dray-gigradar-meta';          // schema version and last backup date
  const PRE_V1_KEY = 'dray-gigradar-pre-v1-copy'; // untouched copy of V0 data, made once
  const RECOVERY_KEY = 'dray-gigradar-unreadable-copy';
  const THEME_KEY = 'dray-gigradar-theme';
  const statuses = Store.STATUSES;

  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n) || 0);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const active = l => ['Contacted', 'Replied', 'Negotiating'].includes(l.status);
const open = l => !['Won', 'Lost'].includes(l.status);
  // Opportunity Intelligence: research readiness.
// This measures information completeness, not hiring intent or budget.
function researchScore(lead) {
  const signals = [
    ['name', 10],
    ['website', 15],
    ['xHandle', 15],
    ['evidenceUrl', 20],
    ['contact', 20],
    ['gap', 20]
  ];

  return signals.reduce((total, signal) => {
    return total + (
      String(lead[signal[0]] || '').trim()
        ? signal[1]
        : 0
    );
  }, 0);
}

function researchTier(score) {
  if (score < 40) return 'needs-research';
  if (score < 70) return 'in-progress';
  return 'ready-review';
}

function researchLabel(score) {
  if (score < 40) return 'Needs research';
  if (score < 70) return 'In progress';
  return 'Ready for review';
}

function researchBadge(lead) {
  const score = researchScore(lead);
  const tier = researchTier(score);

  return '<span class="research-score ' + tier + '">' +
    score + '/100</span><div class="meta">' +
    researchLabel(score) + '</div>';
} 
  const badge = s => '<span class="badge ' + String(s).toLowerCase() + '">' + esc(s) + '</span>';
  const blank = (a, b) => '<div class="empty"><b>' + a + '</b>' + b + '</div>';

  // ---------- storage ----------
  const readStorage = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const writeStorage = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };

  let leads = [];
  let meta = {};
  try { meta = JSON.parse(readStorage(META_KEY) || '{}') || {}; } catch { meta = {}; }
  const savedMeta = () => writeStorage(META_KEY, JSON.stringify(meta));

  function loadLeads() {
    const raw = readStorage(KEY);
    const result = Store.parseStored(raw);
    if (result.damaged) {
      // Keep the unreadable text so nothing is lost, and tell the person.
      if (readStorage(RECOVERY_KEY) == null) writeStorage(RECOVERY_KEY, raw);
      showNotice('Your saved records could not be read. A recovery copy was kept on this device.', raw);
      return [];
    }
    if (raw && !meta.schema) writeStorage(PRE_V1_KEY, raw); // one-time safety copy before upgrading
    if (!meta.schema) { meta.schema = Store.SCHEMA; savedMeta(); }
    return result.leads;
  }

  function showNotice(text, recoveryText) {
    $('noticeText').textContent = text;
    $('notice').hidden = false;
    $('downloadRecovery').hidden = !recoveryText;
    $('downloadRecovery').onclick = () => download('gigradar-recovery-copy.txt', recoveryText, 'text/plain');
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let toastTimer;
  function toast(text, isError) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 2000);
  }
  function save() {
    const ok = writeStorage(KEY, JSON.stringify(leads));

    if (ok) {
      window.dispatchEvent(
        new CustomEvent('gigradar:leads-updated')
      );
    }

    render();

    if (ok) {
      toast('Saved on this device');
    } else {
      toast(
        'Could not save. Check browser storage settings, then export a backup.',
        true
      );
    }

    return ok;
  }
  const sorted = () => [...leads].sort((a, b) => b.updated - a.updated);

  // ---------- rendering ----------
  function row(l) {
    return '<div class="row"><div class="row-left"><div class="logo">' + esc(initials(l.name)) + '</div><div style="min-width:0"><div class="name">' + esc(l.name) +
      '</div><div class="meta">' + esc(l.service) + ' · ' + esc(l.chain) + '</div></div></div><div class="right">' + badge(l.status) +
      ' <button class="icon-btn" data-edit="' + esc(l.id) + '">Edit</button></div></div>';
  }

  const sourceLabel = l => (l && l.sourceType && Sources.TYPE_LABELS[l.sourceType]) || '';

  function links(l) {
    const out = [];
    if (l.website) out.push('<a href="' + esc(l.website) + '" target="_blank" rel="noopener noreferrer">' + esc(l.website.replace(/^https?:\/\/(www\.)?/, '')) + '</a>');
    if (l.xHandle) out.push('<a href="https://x.com/' + esc(l.xHandle.slice(1)) + '" target="_blank" rel="noopener noreferrer">' + esc(l.xHandle) + '</a>');
    if (l.evidenceUrl) out.push('<a href="' + esc(l.evidenceUrl) + '" target="_blank" rel="noopener noreferrer">Evidence</a>');
    if (l.sourceType && l.sourceType !== 'manual') out.push('<span>via ' + esc(sourceLabel(l)) + '</span>');
    return out.length ? '<div class="meta links">' + out.join(' · ') + '</div>' : '';
  }

  function render() {
    const total = leads.length;
    const act = leads.filter(active).length;
    const sum = list => list.reduce((s, l) => s + (+l.value || 0), 0);
    const earned = sum(leads.filter(l => l.status === 'Won' && l.payment === 'Paid'));
    const pending = sum(leads.filter(l => l.status === 'Won' && l.payment !== 'Paid'));
    const potential = sum(leads.filter(open));
    const wins = leads.filter(l => l.status === 'Won').length;
    const today = Store.todayStr();

    $('sLeads').textContent = total;
    $('sActive').textContent = act;
    $('sPotential').textContent = money(potential);
    $('sEarned').textContent = money(earned);
    $('sWon').textContent = wins + ' gigs won';

    $('bars').innerHTML = statuses.map(s => {
      const n = leads.filter(l => l.status === s).length;
      return '<div class="stage">' + s + ' <b>' + n + '</b><div class="bar"><span style="width:' + (total ? Math.max(n ? 8 : 0, n / total * 100) : 0) + '%"></span></div></div>';
    }).join('');

    $('recent').innerHTML = sorted().slice(0, 4).map(row).join('') || blank('Your radar is clear.', 'Add a project you want to investigate.');

    const due = sorted().filter(l => open(l) && l.followup).sort((a, b) => a.followup.localeCompare(b.followup)).slice(0, 5);
    $('followups').innerHTML = due.map(l => {
      const late = l.followup < today;
      return '<div class="row"><div><div class="name">' + esc(l.name) + '</div><div class="meta' + (late ? ' overdue' : '') + '">' +
        (late ? 'Overdue: ' : 'Follow up: ') + esc(l.followup) + '</div></div><button class="icon-btn" data-edit="' + esc(l.id) + '">Open</button></div>';
    }).join('') || blank('No follow-ups scheduled.', 'Add a date so good leads do not go cold.');

    const overdueCount = due.filter(l => l.followup < today).length;
    $('noteText').textContent = !total ? 'Your first goal is not 100 leads. It is 5 well-researched projects and 5 thoughtful approaches.'
      : overdueCount ? overdueCount + ' follow-up(s) are overdue. Handle those before adding new leads.'
      : !act ? 'You have leads but no active conversations. Pick the strongest one and make a specific, useful approach.'
      : due.length ? 'You have follow-ups scheduled. Keep them tied to a real next step.'
      : 'You have ' + act + ' active conversation(s). Give each one a clear next action.';

        const q = ($('search').value || '').toLowerCase();
    const filter = $('filter').value;
    // Safe defaults until the controls are added to index.html.
const readinessFilter = $('researchFilter')?.value || '';
const researchSort = $('researchSort')?.value || 'recent';

    const filtered = sorted().filter(l => {
      const tier = researchTier(researchScore(l));

      return (!filter || l.status === filter) &&
        (!readinessFilter || tier === readinessFilter) &&
        [
          l.name,
          l.chain,
          l.contact,
          l.service,
          l.gap,
          l.website,
          l.xHandle,
          l.category,
          sourceLabel(l),
          l.evidenceUrl
        ].join(' ').toLowerCase().includes(q);
    });

    if (researchSort === 'score') {
      filtered.sort((a, b) =>
        researchScore(b) - researchScore(a) ||
        b.updated - a.updated
      );
    }

    $('leadTable').innerHTML = filtered.map(l =>
      '<tr>' +
        '<td><b>' + esc(l.name) + '</b>' +
          '<div class="meta">' + esc(l.contact || l.service) + '</div>' +
          links(l) +
        '</td>' +
        '<td>' + researchBadge(l) + '</td>' +
        '<td>' + esc(l.chain) + '</td>' +
        '<td>' + badge(l.status) + '</td>' +
        '<td>' + money(l.value) + '</td>' +
        '<td>' + esc(l.followup || 'Not set') + '</td>' +
        '<td><button class="icon-btn" data-edit="' + esc(l.id) +
          '">Edit</button> <button class="icon-btn" data-delete="' +
          esc(l.id) + '" aria-label="Delete ' + esc(l.name) +
          '">×</button></td>' +
      '</tr>'
    ).join('');

    $('leadEmpty').hidden = !!filtered.length;

    const conversations = sorted().filter(l => !['New', 'Lost'].includes(l.status));
    $('outreachRows').innerHTML = conversations.map(l => '<div class="row"><div style="min-width:0"><div class="name">' + esc(l.name) +
      ' <span style="color:var(--muted);font-weight:400">' + esc(l.contact) + '</span></div><div class="meta">' + esc(l.next || l.gap || 'Add your next action in the lead notes.') +
      '</div></div><div class="right">' + badge(l.status) + ' <button class="icon-btn" data-edit="' + esc(l.id) + '">Update</button></div></div>').join('')
      || blank('No conversations yet.', 'Update a lead to Contacted after sending a thoughtful pitch.');

    $('pStats').innerHTML = [['New leads', leads.filter(l => l.status === 'New').length], ['In conversation', act], ['Won gigs', wins], ['Lost / closed', leads.filter(l => l.status === 'Lost').length]]
      .map(a => '<article class="stat"><label>' + a[0] + '</label><strong>' + a[1] + '</strong></article>').join('');
    $('pipeRows').innerHTML = sorted().map(row).join('') || blank('Your pipeline is empty.', 'Add a lead to start tracking it.');

    $('iEarned').textContent = money(earned);
    $('iPending').textContent = money(pending);
    $('iPipeline').textContent = money(potential);
    const wonRows = sorted().filter(l => l.status === 'Won');
    $('incomeTable').innerHTML = wonRows.map(l => '<tr><td>' + esc(l.name) + '</td><td>' + badge(l.status) + '</td><td>' + money(l.value) + '</td><td>' + esc(l.payment) +
      '</td><td><button class="icon-btn" data-edit="' + esc(l.id) + '">Edit</button></td></tr>').join('');
    $('incomeEmpty').hidden = !!wonRows.length;

    renderBackupInfo();
  }

  function renderBackupInfo() {
    const when = meta.lastBackup ? new Date(meta.lastBackup).toLocaleString() : null;
    $('backupInfo').textContent = when ? 'Last backup: ' + when + '. Records live only in this browser.'
      : leads.length ? 'No backup yet. Records live only in this browser, so export a copy now.'
      : 'Records live only in this browser. Export a copy regularly.';
    $('backupInfo').classList.toggle('overdue', !when && leads.length > 0);
  }

  // ---------- form ----------
  const FIELDS = ['name', 'chain', 'category', 'website', 'xHandle', 'evidenceUrl', 'contact', 'service', 'status', 'value', 'followup', 'payment', 'gap', 'next'];
  const ERROR_FIELDS = ['name', 'website', 'xHandle', 'evidenceUrl'];

  function clearErrors() {
    ERROR_FIELDS.forEach(f => {
      $('err-' + f).hidden = true; $('err-' + f).textContent = '';
      $(f).removeAttribute('aria-invalid');
    });
  }

  function openModal(l) {
    $('form').reset();
    clearErrors();
    $('editId').value = l?.id || '';
    $('modalTitle').textContent = l ? 'Update opportunity' : 'Track an opportunity';
    if (l) FIELDS.forEach(f => { if (l[f] !== undefined) $(f).value = l[f]; });
    const parts = [];
    if (sourceLabel(l)) parts.push('Source: ' + sourceLabel(l));
    if (l && l.discovered) parts.push('Added ' + l.discovered);
    $('srcLine').textContent = parts.join(' · ');
    $('srcLine').hidden = !parts.length;
    $('goImport').hidden = !!l;
    $('modal').classList.add('open');
    setTimeout(() => $('name').focus(), 50);
  }
  const closeModal = () => $('modal').classList.remove('open');

  function showFieldError(field, message, duplicateLead, imported) {
    const el = $(imported ? 'imp-err-' + field : 'err-' + field);
    const input = $(imported ? 'imp-' + field : field);
    el.textContent = message;
    if (duplicateLead) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'text-btn'; b.textContent = 'Open existing';
      b.dataset.edit = duplicateLead.id;
      el.append(' ', b);
    }
    el.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  $('form').onsubmit = e => {
    e.preventDefault();
    clearErrors();
    const id = $('editId').value;
    const old = leads.find(l => l.id === id);
    const input = Object.assign({}, old || {});
    FIELDS.forEach(f => { input[f] = $(f).value; });
    input.id = id || Store.newId();
    input.created = old?.created || Date.now();
    input.updated = Date.now();
    if (!old) { input.sourceType = 'manual'; input.discovered = Store.todayStr(); }

    const result = Store.validateLead(input, leads, id || null);
    if (!result.ok) {
      Object.entries(result.errors).forEach(([f, msg]) => showFieldError(f, msg, f === 'name' ? result.duplicate : null));
      $(Object.keys(result.errors)[0]).focus();
      return;
    }
    leads = old ? leads.map(x => x.id === id ? result.lead : x) : [result.lead, ...leads];
    closeModal();
    save();
  };

  // ---------- import from a link ----------
  const IMP_FIELDS = ['name', 'chain', 'category', 'website', 'xHandle', 'sourceType', 'evidenceUrl', 'gap'];
  let impSourceUrl = '';

  function clearImpErrors() {
    ['linkErr'].concat(IMP_FIELDS.map(f => 'imp-err-' + f)).forEach(id => { $(id).hidden = true; $(id).textContent = ''; });
    IMP_FIELDS.forEach(f => $('imp-' + f).removeAttribute('aria-invalid'));
    $('linkInput').removeAttribute('aria-invalid');
  }

  function openImport() {
    closeModal();
    $('impForm').reset();
    $('linkInput').value = '';
    impSourceUrl = '';
    clearImpErrors();
    $('detect').hidden = true;
    $('impForm').hidden = true;
    $('manualImp').hidden = false;
    $('importModal').classList.add('open');
    setTimeout(() => $('linkInput').focus(), 50);
  }
  const closeImport = () => $('importModal').classList.remove('open');

  function showImpForm() {
    $('impForm').hidden = false;
    $('manualImp').hidden = true;
    setTimeout(() => $('imp-name').focus(), 50);
  }

  function checkLink() {
    clearImpErrors();
    $('detect').hidden = true;
    const r = Sources.classify($('linkInput').value);
    if (!r.ok) {
      $('linkErr').textContent = r.error + ' You can still enter the details manually.';
      $('linkErr').hidden = false;
      $('linkInput').setAttribute('aria-invalid', 'true');
      return;
    }
    $('impForm').reset();
    const s = r.suggest;
    $('imp-name').value = s.name;
    $('imp-website').value = s.website;
    $('imp-xHandle').value = s.xHandle;
    $('imp-sourceType').value = s.sourceType;
    $('imp-evidenceUrl').value = s.evidenceUrl;
    impSourceUrl = s.sourceUrl;
    $('detType').textContent = r.typeLabel + (r.confidence === 'guess' ? ' (best guess)' : '');
    $('detNotes').textContent = r.notes.join(' ');
    $('detect').hidden = false;
    showImpForm();
  }

  $('checkLink').onclick = checkLink;
  $('linkInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); checkLink(); } };
  $('linkInput').addEventListener('paste', () => setTimeout(checkLink, 0));
  $('manualImp').onclick = () => { impSourceUrl = ''; $('imp-sourceType').value = 'manual'; showImpForm(); };
  $('impClose').onclick = $('impCancel').onclick = closeImport;
  $('importModal').onclick = e => { if (e.target === $('importModal')) closeImport(); };

  $('impForm').onsubmit = e => {
    e.preventDefault();
    clearImpErrors();
    const input = {};
    IMP_FIELDS.forEach(f => { input[f] = $('imp-' + f).value; });
    input.id = Store.newId();
    input.status = 'New';
    input.created = input.updated = Date.now();
    input.discovered = Store.todayStr();
    input.sourceUrl = impSourceUrl;

    const result = Store.validateLead(input, leads, null);
    if (!result.ok) {
      const fields = Object.keys(result.errors);
      fields.forEach(f => {
        if (IMP_FIELDS.includes(f)) showFieldError(f, result.errors[f], f === 'name' ? result.duplicate : null, true);
        else { $('linkErr').textContent = result.errors[f]; $('linkErr').hidden = false; }
      });
      const firstField = fields.find(f => IMP_FIELDS.includes(f));
      if (firstField) $('imp-' + firstField).focus();
      return;
    }
    leads = [result.lead, ...leads];
    closeImport();
    save();
  };

    // ---------- navigation ----------
  const titles = {
    overview: 'Overview',
    discovery: 'Discover projects',
    leads: 'Project leads',
    outreach: 'Outreach',
    pipeline: 'Gig pipeline',
    income: 'Income'
  };

  function go(v) {
    if (!titles[v] || !$('view-' + v)) v = 'overview';

    document.querySelectorAll('.view').forEach(x =>
      x.classList.toggle('active', x.id === 'view-' + v)
    );

    document.querySelectorAll('[data-view]').forEach(x =>
      x.classList.toggle('active', x.dataset.view === v)
    );

    $('crumb').textContent = titles[v];
    window.scrollTo(0, 0);
  }

  // ---------- backup ----------
  $('exportBtn').onclick = () => {
    const stamp = Store.todayStr();
    download('gigradar-backup-' + stamp + '.json', Store.buildExport(leads), 'application/json');
    meta.lastBackup = Date.now();
    savedMeta();
    renderBackupInfo();
    $('dataMsg').textContent = 'Exported ' + leads.length + ' lead(s) to gigradar-backup-' + stamp + '.json.';
  };

  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const msg = $('dataMsg');
    let text;
    try { text = await file.text(); } catch { msg.textContent = 'Could not read that file.'; return; }
    const parsed = Store.parseImport(text);
    if (!parsed.ok) { msg.textContent = parsed.error; return; }
    const r = Store.mergeImport(leads, parsed.leads);
    leads = r.merged;
    const saved = save();
    msg.textContent = (saved ? 'Import finished: ' : 'Import not saved to storage: ') + r.added + ' added, ' + r.updated + ' updated, ' + r.duplicates + ' skipped as duplicates' +
      (parsed.skippedInvalid ? ', ' + parsed.skippedInvalid + ' ignored (no project name)' : '') + '.';
  };

  // ---------- theme ----------
  function applyTheme(theme, persist) {
    const light = theme === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    $('themeLabel').textContent = light ? 'Dark' : 'Light';
    $('themeToggle').setAttribute('aria-pressed', String(light));
    $('themeToggle').setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f4f7f1' : '#101411');
    if (persist) writeStorage(THEME_KEY, light ? 'light' : 'dark');
  }
  $('themeToggle').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);

  // ---------- appearance customization ----------
  const APPEARANCE_KEY = 'dray-gigradar-appearance';

  const defaultAppearance = {
    background: '#101411',
    fontSize: 100,
    fontStyle: 'system'
  };

  const fontFamilies = {
    system: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    georgia: 'Georgia, serif',
    mono: 'monospace',
    trebuchet: '"Trebuchet MS", sans-serif'
  };

  function applyAppearance(persist) {
    const background = $('backgroundColor').value;
    const fontSize = Number($('fontSize').value);
    const fontStyle = $('fontStyle').value;

    document.body.style.background = background;
    document.body.style.fontFamily =
      fontFamilies[fontStyle] || fontFamilies.system;

    document.body.style.zoom = String(fontSize / 100);
    $('fontSizeLabel').textContent = fontSize + '%';

    document.querySelector('meta[name="theme-color"]')
      .setAttribute('content', background);

    if (persist) {
      writeStorage(APPEARANCE_KEY, JSON.stringify({
        background,
        fontSize,
        fontStyle
      }));
    }
  }

  function loadAppearance() {
    let settings = defaultAppearance;

    try {
      const saved = JSON.parse(
        readStorage(APPEARANCE_KEY) || 'null'
      );

      if (saved && typeof saved === 'object') {
        settings = { ...defaultAppearance, ...saved };
      }
    } catch {
      settings = defaultAppearance;
    }

    const validColor = /^#[0-9a-fA-F]{6}$/.test(settings.background);
    const validSize = [90, 95, 100, 105, 110, 115, 120]
      .includes(Number(settings.fontSize));
    const validFont = Object.prototype.hasOwnProperty.call(
      fontFamilies,
      settings.fontStyle
    );

    $('backgroundColor').value =
      validColor ? settings.background : defaultAppearance.background;

    $('fontSize').value =
      validSize ? Number(settings.fontSize) : defaultAppearance.fontSize;

    $('fontStyle').value =
      validFont ? settings.fontStyle : defaultAppearance.fontStyle;

    applyAppearance(false);
  }

  $('backgroundColor').addEventListener('input', () => {
    applyAppearance(true);
  });

  $('fontSize').addEventListener('input', () => {
    applyAppearance(true);
  });

  $('fontStyle').addEventListener('change', () => {
    applyAppearance(true);
  });

  $('resetAppearance').addEventListener('click', () => {
    $('backgroundColor').value = defaultAppearance.background;
    $('fontSize').value = defaultAppearance.fontSize;
    $('fontStyle').value = defaultAppearance.fontStyle;
    applyAppearance(true);
  });

  loadAppearance(); 
  // ---------- wiring ----------
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
  document.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));
  ['sideAdd', 'addTop', 'addList', 'addPipe', 'fab'].forEach(id => $(id).onclick = () => openModal());
  ['importTop', 'importLeads', 'goImport'].forEach(id => $(id).onclick = openImport);
  $('close').onclick = $('cancel').onclick = closeModal;
  $('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
  document.onkeydown = e => { if (e.key === 'Escape') { closeModal(); closeImport(); } };
  $('search').oninput = render;
$('filter').onchange = render;

if ($('researchFilter')) {
  $('researchFilter').onchange = render;
}

if ($('researchSort')) {
  $('researchSort').onchange = render;
}
  document.addEventListener('click', e => {
    let b = e.target.closest('[data-edit]');
    if (b) {
      const l = leads.find(x => x.id === b.dataset.edit);
      if (l) { closeImport(); openModal(l); }
      return;
    }
    b = e.target.closest('[data-delete]');
    if (b) {
      const l = leads.find(x => x.id === b.dataset.delete);
      if (l && confirm('Delete ' + l.name + '? This cannot be undone. Export a backup first if unsure.')) {
        leads = leads.filter(x => x.id !== l.id);
        save();
      }
    }
  });

  // ---------- start ----------
  applyTheme(document.documentElement.getAttribute('data-theme'), false);
  leads = loadLeads();
  render();
})();
