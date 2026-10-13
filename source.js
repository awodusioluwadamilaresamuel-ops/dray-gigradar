/* GigRadar link reader. Works only on the text of a link: it never opens the page
   or contacts any website, so every suggestion is a guess for the person to confirm. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./store.js'));
  else root.GigSources = factory(root.GigStore);
})(typeof self !== 'undefined' ? self : this, function (Store) {
  'use strict';

  var TYPE_LABELS = {
    'x-profile': 'X profile',
    'x-post': 'X post',
    'github-repo': 'GitHub repository',
    'github-org': 'GitHub profile or organization',
    directory: 'Project directory',
    job: 'Job or bounty listing',
    website: 'Project website',
    manual: 'Entered manually',
    other: 'Other link'
  };

  var X_RESERVED = ['home', 'search', 'explore', 'i', 'intent', 'share', 'hashtag', 'notifications', 'messages', 'settings', 'compose', 'login', 'signup', 'tos', 'privacy', 'about', 'download'];
  var GH_RESERVED = ['orgs', 'settings', 'topics', 'marketplace', 'features', 'sponsors', 'about', 'pricing', 'login', 'join', 'explore', 'search', 'notifications', 'issues', 'pulls', 'collections', 'enterprise', 'security', 'apps', 'events', 'readme', 'new', 'trending', 'organizations'];
  // Hostname lists are a starting point for guessing, not an endorsement or a verified integration.
  var DIRECTORY_HOSTS = ['defillama.com', 'dappradar.com', 'coingecko.com', 'coinmarketcap.com', 'cryptorank.io', 'rootdata.com', 'messari.io', 'alchemy.com', 'dapplist.com'];
  var JOB_HOSTS = ['web3.career', 'cryptocurrencyjobs.co', 'cryptojobslist.com', 'earn.superteam.fun', 'remote3.co', 'cryptojobs.com'];
  var JOB_WORDS = /^(jobs?|careers?|hiring|bounty|bounties|openings?|positions?|work-with-us|join-us)$/i;
  var TWO_LEVEL = ['co', 'com', 'org', 'net', 'gov', 'ac'];

  var fail = function (error) { return { ok: false, error: error }; };
  var hostMatches = function (host, list) { return list.some(function (h) { return host === h || host.slice(-(h.length + 1)) === '.' + h; }); };

  function titleCase(words) {
    return words.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }
  function slugToName(slug) {
    var s = slug;
    try { s = decodeURIComponent(slug); } catch (e) { /* keep raw */ }
    return titleCase(s.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 90);
  }
  function domainName(host) {
    var parts = host.replace(/^www\./, '').split('.');
    var i = parts.length - 2;
    if (parts.length >= 3 && parts[parts.length - 1].length === 2 && TWO_LEVEL.indexOf(parts[parts.length - 2]) >= 0) i = parts.length - 3;
    return titleCase(parts[Math.max(i, 0)] || '');
  }
  function stripTracking(u) {
    var drop = [];
    u.searchParams.forEach(function (v, k) { if (/^utm_/i.test(k) || ['fbclid', 'gclid', 'ref_src', 'igshid'].indexOf(k.toLowerCase()) >= 0) drop.push(k); });
    drop.forEach(function (k) { u.searchParams.delete(k); });
  }
  var finish = function (type, url, confidence, suggest, notes) {
    var s = Object.assign({ name: '', website: '', xHandle: '', sourceType: type === 'other' ? '' : type, sourceUrl: url, evidenceUrl: '' }, suggest);
    return { ok: true, url: url, type: type, typeLabel: TYPE_LABELS[type], confidence: confidence, suggest: s, notes: notes || [] };
  };

  function classify(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) return fail('Paste a link first.');
    if (raw.length > 500) return fail('That link is too long.');

    var handleOnly = raw.match(/^@([A-Za-z0-9_]{1,15})$/);
    if (handleOnly) {
      var h = handleOnly[1];
      return finish('x-profile', 'https://x.com/' + h, 'certain', { name: h, xHandle: '@' + h }, ['Name is taken from the handle. Change it if the project goes by something else.']);
    }

    var n = Store.normalizeUrl(raw, 'link');
    if (!n.ok) return fail(n.error);
    var u = new URL(n.value);
    var host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === 'localhost') return fail('Use a project link, not an IP address.');
    var path = u.pathname.split('/').filter(Boolean);

    // ----- X / Twitter
    var xHost = host.replace(/^(mobile|m)\./, '');
    if (xHost === 'x.com' || xHost === 'twitter.com') {
      var first = path[0];
      var noHandle = ['Could not find a project account in this X link. Add the details yourself.'];
      if (!first) return finish('other', 'https://x.com', 'guess', {}, noHandle);
      if (first === 'i' && path[1] === 'web' && path[2] === 'status' && /^\d+$/.test(path[3] || '')) {
        var anon = 'https://x.com/i/web/status/' + path[3];
        return finish('x-post', anon, 'certain', { evidenceUrl: anon }, ['This post link does not show who wrote it. Add the project\'s X profile yourself.']);
      }
      if (X_RESERVED.indexOf(first.toLowerCase()) >= 0 || !/^[A-Za-z0-9_]{1,15}$/.test(first)) return finish('other', 'https://x.com/' + path.join('/'), 'guess', {}, noHandle);
      if (path[1] === 'status' && /^\d+$/.test(path[2] || '')) {
        var post = 'https://x.com/' + first + '/status/' + path[2];
        return finish('x-post', post, 'certain', { name: first, xHandle: '@' + first, evidenceUrl: post },
          ['The handle is the author of this post. Check that it is the project\'s own account and not a person or a reply.']);
      }
      return finish('x-profile', 'https://x.com/' + first, 'certain', { name: first, xHandle: '@' + first }, ['Name is taken from the handle. Change it if the project goes by something else.']);
    }

    // ----- GitHub
    if (host === 'github.com') {
      var owner = path[0];
      if (!owner || GH_RESERVED.indexOf(owner.toLowerCase()) >= 0 || !/^[A-Za-z0-9-]{1,39}$/.test(owner)) {
        return finish('other', 'https://github.com' + u.pathname.replace(/\/$/, ''), 'guess', {}, ['This GitHub page is not a project or organization. Add the details yourself.']);
      }
      if (path.length === 1) {
        var orgUrl = 'https://github.com/' + owner;
        return finish('github-org', orgUrl, 'certain', { name: slugToName(owner) }, ['GitHub names are only a guess. Confirm the project name.']);
      }
      var repo = path[1].replace(/\.git$/i, '');
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) return finish('other', 'https://github.com/' + owner, 'guess', {}, ['Could not read the repository name. Add the details yourself.']);
      var repoUrl = 'https://github.com/' + owner + '/' + repo;
      var evidence = ['issues', 'pull', 'pulls', 'discussions'].indexOf((path[2] || '').toLowerCase()) >= 0 ? repoUrl + '/' + path.slice(2, 4).join('/') : '';
      return finish('github-repo', repoUrl, 'certain', { name: slugToName(repo), evidenceUrl: evidence },
        ['GitHub names are only a guess. Confirm the project name.'].concat(evidence ? ['The issue or discussion link was kept as evidence. Remove it if it does not show a need.'] : []));
    }

    stripTracking(u);
    var clean = u.href.replace(/\/$/, '');
    var origin = u.protocol + '//' + u.host;

    // ----- Job and bounty boards, and project career pages
    if (hostMatches(host, JOB_HOSTS)) {
      return finish('job', clean, 'guess', { evidenceUrl: clean }, ['This looks like a job board. Add the project\'s name, website and X profile from the listing.']);
    }
    if (path.some(function (p) { return JOB_WORDS.test(p); })) {
      return finish('job', clean, 'guess', { name: domainName(host), website: origin, evidenceUrl: clean },
        ['This looks like a careers or bounty page on the project\'s own site. Confirm that before relying on it.']);
    }

    // ----- Directories
    if (hostMatches(host, DIRECTORY_HOSTS)) {
      var last = path.length ? path[path.length - 1] : '';
      return finish('directory', clean, 'guess', { name: last ? slugToName(last) : '' },
        ['A directory listing shows a project exists, not that it needs help. Add the project\'s own website and X profile.']);
    }

    // ----- Anything else: treat as the project's website
    return finish('website', clean, 'guess', { name: domainName(host), website: origin }, ['Name is taken from the web address. Change it if the project goes by something else.']);
  }

  return { classify: classify, TYPE_LABELS: TYPE_LABELS };
});
