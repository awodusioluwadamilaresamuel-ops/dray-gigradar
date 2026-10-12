/* GigRadar data logic. No DOM access, so it can be tested on its own. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GigStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['New', 'Contacted', 'Replied', 'Negotiating', 'Won', 'Lost'];
  var PAYMENTS = ['Not agreed', 'Pending', 'Paid'];
  var SCHEMA = 2;

  var str = function (v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); };
  var newId = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  // Website: accepts "example.com" or "https://example.com/path". Only http(s) is allowed.
  function normalizeUrl(input) {
    var s = str(input, 300);
    if (!s) return { ok: true, value: '' };
    if (/^(javascript|data|mailto|ftp|file|blob|vbscript):/i.test(s)) return { ok: false, error: 'Website must start with http:// or https://.' };
    var withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s;
    var u;
    try { u = new URL(withScheme); } catch (e) { return { ok: false, error: 'Enter a valid website, like example.com.' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Website must start with http:// or https://.' };
    if (!/^[^.\s]+(\.[^.\s]+)+$/.test(u.hostname)) return { ok: false, error: 'Enter a valid website, like example.com.' };
    return { ok: true, value: u.href.replace(/\/$/, '') };
  }

  // X profile: accepts "@name", "name", or an x.com / twitter.com link. Stored as "@name".
  function normalizeHandle(input) {
    var s = str(input, 200);
    if (!s) return { ok: true, value: '' };
    var m = s.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})(?:[/?#].*)?$/i);
    var name = m ? m[1] : s.replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{1,15}$/.test(name)) return { ok: false, error: 'Enter an X handle like @project, or a link to the profile.' };
    return { ok: true, value: '@' + name };
  }

  var hostOf = function (url) { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
  var nameKey = function (n) { return str(n, 90).toLowerCase().replace(/[^a-z0-9]+/g, ''); };

  // Coerce any stored or imported record into the current shape. Never throws.
  function normalizeLead(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var now = Date.now();
    var value = Number(r.value), created = Number(r.created), updated = Number(r.updated);
    return {
      id: str(r.id, 40) || newId(),
      name: str(r.name, 90),
      chain: str(r.chain, 60) || 'Other',
      contact: str(r.contact, 100),
      service: str(r.service, 60) || 'Other',
      status: STATUSES.indexOf(r.status) >= 0 ? r.status : 'New',
      value: isFinite(value) && value > 0 ? value : 0,
      followup: /^\d{4}-\d{2}-\d{2}$/.test(str(r.followup)) ? str(r.followup) : '',
      payment: PAYMENTS.indexOf(r.payment) >= 0 ? r.payment : 'Not agreed',
      gap: str(r.gap, 500),
      next: str(r.next, 500),
      website: normalizeUrl(r.website).ok ? normalizeUrl(r.website).value : '',
      xHandle: normalizeHandle(r.xHandle).ok ? normalizeHandle(r.xHandle).value : '',
      created: isFinite(created) && created > 0 ? created : now,
      updated: isFinite(updated) && updated > 0 ? updated : now
    };
  }

  // Returns {lead, reason} if `candidate` matches an existing record, else null.
  function findDuplicate(leads, candidate, ignoreId) {
    var host = hostOf(candidate.website), key = nameKey(candidate.name), handle = (candidate.xHandle || '').toLowerCase();
    for (var i = 0; i < leads.length; i++) {
      var l = leads[i];
      if (ignoreId && l.id === ignoreId) continue;
      if (host && hostOf(l.website) === host) return { lead: l, reason: 'the same website' };
      if (handle && (l.xHandle || '').toLowerCase() === handle) return { lead: l, reason: 'the same X profile' };
      if (key && nameKey(l.name) === key && (l.chain || '') === (candidate.chain || '')) return { lead: l, reason: 'the same name and chain' };
    }
    return null;
  }

  // Validate form values and build a lead. Returns {ok, lead} or {ok:false, errors:{field:msg}, duplicate?}.
  function validateLead(input, existing, ignoreId) {
    var errors = {};
    var name = str(input.name, 90);
    if (!name) errors.name = 'Enter the project name.';
    var site = normalizeUrl(input.website);
    if (!site.ok) errors.website = site.error;
    var x = normalizeHandle(input.xHandle);
    if (!x.ok) errors.xHandle = x.error;
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var lead = normalizeLead(Object.assign({}, input, { name: name, website: site.value, xHandle: x.value }));
    var dup = findDuplicate(existing, lead, ignoreId);
    if (dup) return { ok: false, errors: { name: 'Already tracked as "' + dup.lead.name + '" (' + dup.reason + ').' }, duplicate: dup.lead };
    return { ok: true, lead: lead };
  }

  // Read the stored array. Damaged or non-array data is reported, never silently replaced.
  function parseStored(raw) {
    if (raw == null || raw === '') return { leads: [], damaged: false };
    try {
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return { leads: [], damaged: true };
      return { leads: data.filter(function (x) { return x && typeof x === 'object'; }).map(normalizeLead), damaged: false };
    } catch (e) { return { leads: [], damaged: true }; }
  }

  function buildExport(leads, nowMs) {
    return JSON.stringify({ app: 'gigradar', schema: SCHEMA, exportedAt: new Date(nowMs || Date.now()).toISOString(), leads: leads }, null, 2);
  }

  function parseImport(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON. Choose a GigRadar backup file.' }; }
    var list = Array.isArray(data) ? data : data && Array.isArray(data.leads) ? data.leads : null;
    if (!list) return { ok: false, error: 'No leads found. Choose a backup exported from GigRadar.' };
    var leads = list.filter(function (x) { return x && typeof x === 'object' && str(x.name); }).map(normalizeLead);
    return { ok: true, leads: leads, skippedInvalid: list.length - leads.length };
  }

  // Merge imported leads into existing ones. Nothing existing is deleted.
  function mergeImport(existing, incoming) {
    var merged = existing.slice(), added = 0, updated = 0, duplicates = 0;
    incoming.forEach(function (inc) {
      var byId = merged.findIndex(function (l) { return l.id === inc.id; });
      if (byId >= 0) {
        if (inc.updated > merged[byId].updated) { merged[byId] = inc; updated++; } else duplicates++;
        return;
      }
      if (findDuplicate(merged, inc)) { duplicates++; return; }
      merged.push(inc); added++;
    });
    return { merged: merged, added: added, updated: updated, duplicates: duplicates };
  }

  // Local calendar date as YYYY-MM-DD (follow-up dates are local, not UTC).
  function todayStr(d) {
    d = d || new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  return { STATUSES: STATUSES, PAYMENTS: PAYMENTS, SCHEMA: SCHEMA, normalizeUrl: normalizeUrl, normalizeHandle: normalizeHandle,
    normalizeLead: normalizeLead, findDuplicate: findDuplicate, validateLead: validateLead, parseStored: parseStored,
    buildExport: buildExport, parseImport: parseImport, mergeImport: mergeImport, todayStr: todayStr, newId: newId };
});
