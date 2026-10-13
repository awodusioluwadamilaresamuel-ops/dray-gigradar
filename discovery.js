/* GigRadar Phase B: public GitHub repository discovery.
   Browser-only, no API key. Results are project leads to investigate, not proof of hiring or budget. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('discoveryForm');
  if (!form) return;
  const queryInput = $('discoveryQuery');
  const ecosystem = $('discoveryEcosystem');
  const results = $('discoveryResults');
  const status = $('discoveryStatus');
  const searchBtn = $('discoverySearch');
  const moreBtn = $('discoveryMore');
  let page = 1;
  let lastQuery = '';
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = value => {
    if (!value) return 'Unknown';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
  };
  const ageDate = days => new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
  function buildQuery() {
    const terms = queryInput.value.trim();
    const eco = ecosystem.value;
    const defaults = {solana:'solana',base:'base blockchain',evm:'ethereum',ton:'ton blockchain',all:'web3 crypto'};
    const keywords = terms || defaults[eco] || defaults.all;
    const ecosystemTerm = terms ? '' : '';
    return keywords + ecosystemTerm + ' pushed:>=' + ageDate(180) + ' archived:false';
  }
  function renderRepo(repo) {
    const desc = repo.description || 'No description provided. Review the repository and project links before reaching out.';
    const lang = repo.language || 'Not specified';
    return '<article class="discovery-card">' +
      '<h3><a href="' + esc(repo.html_url) + '" target="_blank" rel="noopener noreferrer">' + esc(repo.full_name) + '</a></h3>' +
      '<p class="discovery-desc">' + esc(desc) + '</p>' +
      '<div class="discovery-meta"><span class="discovery-tag">★ ' + Number(repo.stargazers_count || 0).toLocaleString() + '</span>' +
      '<span class="discovery-tag">' + esc(lang) + '</span><span class="discovery-tag">Updated ' + esc(fmtDate(repo.pushed_at)) + '</span>' +
      '<span class="discovery-tag">Public repo</span></div>' +
      '<div class="discovery-footer"><button class="btn primary" type="button" data-discovery-import="' + esc(repo.html_url) + '">Track this project</button>' +
      '<a href="' + esc(repo.owner && repo.owner.html_url || repo.html_url) + '" target="_blank" rel="noopener noreferrer">View owner ↗</a></div></article>';
  }
  async function search(reset) {
    if (busy) return;
    if (reset) { page = 1; lastQuery = buildQuery(); results.innerHTML = ''; }
    if (!lastQuery) lastQuery = buildQuery();
    busy = true;
    searchBtn.disabled = true;
    moreBtn.disabled = true;
    status.textContent = 'Searching public GitHub repositories…';
    try {
      const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(lastQuery) +
        '&sort=updated&order=desc&per_page=20&page=' + page;
      const response = await fetch(url, {headers:{'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
      if (response.status === 403 || response.status === 429) throw new Error('GitHub search limit reached. Wait a minute or two before trying again.');
      if (!response.ok) throw new Error('GitHub returned an error (' + response.status + '). Try a simpler keyword.');
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (reset) results.innerHTML = '';
      if (!items.length && page === 1) {
        results.innerHTML = '<div class="empty"><b>No repositories found.</b> Try a broader keyword or another ecosystem.</div>';
      } else {
        results.insertAdjacentHTML('beforeend', items.map(renderRepo).join(''));
      }
      const count = Number(data.total_count || 0);
      status.textContent = 'Showing ' + results.querySelectorAll('.discovery-card').length + ' results from a search with ' + count.toLocaleString() + ' matching repositories. Recent activity is a signal to investigate, not proof they are hiring.';
      moreBtn.hidden = items.length < 20 || results.querySelectorAll('.discovery-card').length >= 100;
      page += 1;
    } catch (error) {
      status.textContent = error.message || 'Could not reach GitHub. Check your connection and retry.';
      moreBtn.hidden = true;
    } finally {
      busy = false;
      searchBtn.disabled = false;
      moreBtn.disabled = false;
    }
  }
  form.addEventListener('submit', e => { e.preventDefault(); search(true); });
  moreBtn.addEventListener('click', () => search(false));
  results.addEventListener('click', e => {
    const button = e.target.closest('[data-discovery-import]');
    if (!button) return;
    const link = button.getAttribute('data-discovery-import');
    const importButton = $('importTop');
    if (!importButton || !$('linkInput') || !$('checkLink')) {
      status.textContent = 'Open Import link from the overview and paste this repository URL: ' + link;
      return;
    }
    importButton.click();
    window.setTimeout(() => {
      $('linkInput').value = link;
      $('checkLink').click();
    }, 80);
  });
})();
