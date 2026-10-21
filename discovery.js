/* GigRadar Phase B: public GitHub repository discovery.
Browser-only, no API key.
Results are project leads to investigate, not proof of hiring or budget. */
(() => {
'use strict';

const $ = id => document.getElementById(id);
const form = $('discoveryForm');

// Safely exit if the Discover page is not present.
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

const MAX_RESULTS = 100;
const PAGE_SIZE = 20;
const SEARCH_DAYS = 180;

const LEADS_KEY = 'dray-gigradar-v1';

function normalizeRepoUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return '';

    const path = url.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .toLowerCase();

    return 'https://github.com' + path;
  } catch {
    return '';
  }
}

function isTracked(repoUrl) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LEADS_KEY) || '[]'
    );

    if (!Array.isArray(saved)) return false;

    const target = normalizeRepoUrl(repoUrl);

    return saved.some(lead =>
      lead &&
      [lead.sourceUrl, lead.website, lead.evidenceUrl]
        .some(link => normalizeRepoUrl(link) === target && target)
    );
  } catch {
    return false;
  }
}
const ecosystemTerms = {
solana: 'solana',
base: 'base blockchain',
evm: 'ethereum OR EVM',
ton: 'TON blockchain',
all: 'web3 OR crypto'
};

const escapeHTML = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

function formatDate(value) {
if (!value) return 'Unknown';

const date = new Date(value);

return Number.isNaN(date.getTime())
  ? 'Unknown'
  : date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

}

function dateDaysAgo(days) {
return new Date(Date.now() - days * 86400000)
.toISOString()
.slice(0, 10);
}

function buildQuery() {
const keywords = queryInput.value.trim();
const selectedEcosystem = ecosystem.value;

const ecosystemTerm = ecosystemTerms[selectedEcosystem]
  || ecosystemTerms.all;

// Apply the selected ecosystem even when custom keywords are entered.
const searchTerms = keywords
  ? '(' + keywords + ') ' + ecosystemTerm
  : ecosystemTerm;

return searchTerms
  + ' pushed:>=' + dateDaysAgo(SEARCH_DAYS)
  + ' archived:false';

}

function renderRepository(repo) {
const description = repo.description
|| 'No description provided. Review the repository and project links before reaching out.';

const language = repo.language || 'Not specified';
const stars = Number(repo.stargazers_count || 0).toLocaleString();
const tracked = isTracked(repo.html_url || '');
const repoURL = escapeHTML(repo.html_url || '#');
const ownerURL = escapeHTML(
  repo.owner && repo.owner.html_url
    ? repo.owner.html_url
    : repo.html_url || '#'
);

return `
  <article class="discovery-card"
  data-repo-url="${repoURL}">
    <h3>
      <a href="${repoURL}" target="_blank" rel="noopener noreferrer">
        ${escapeHTML(repo.full_name || 'Unnamed repository')}
      </a>
    </h3>

    <p class="discovery-desc">${escapeHTML(description)}</p>

    <div class="discovery-meta">
      <span class="discovery-tag">★ ${stars}</span>
      <span class="discovery-tag">${escapeHTML(language)}</span>
      <span class="discovery-tag">
        Updated ${escapeHTML(formatDate(repo.pushed_at))}
      </span>
      <span class="discovery-tag">Public repo</span>
    </div>

    <div class="discovery-footer">
      <button
  class="btn primary"
  type="button"
  data-discovery-import="${repoURL}"
  ${tracked ? 'disabled' : ''}>
  ${tracked ? 'Already tracked ✓' : 'Track this project'}
</button>
      <a href="${ownerURL}" target="_blank" rel="noopener noreferrer">
        View owner ↗
      </a>
    </div>
  </article>
`;

}

function updateMoreButton(itemCount) {
const displayed = results.querySelectorAll('.discovery-card').length;

moreBtn.hidden = itemCount < PAGE_SIZE || displayed >= MAX_RESULTS;

}

async function search(reset) {
if (busy) return;

if (reset) {
  page = 1;
  lastQuery = buildQuery();
  results.innerHTML = '';
  moreBtn.hidden = true;
}

if (!lastQuery) {
  lastQuery = buildQuery();
}

busy = true;
searchBtn.disabled = true;
moreBtn.disabled = true;

status.textContent = reset
  ? 'Searching public GitHub repositories…'
  : 'Loading more projects…';

try {
  const url =
    'https://api.github.com/search/repositories?q='
    + encodeURIComponent(lastQuery)
    + '&sort=updated&order=desc&per_page='
    + PAGE_SIZE
    + '&page='
    + page;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (response.status === 403 || response.status === 429) {
    throw new Error(
      'GitHub search rate limit reached. Wait a minute or two before trying again.'
    );
  }

  if (!response.ok) {
    throw new Error(
      'GitHub returned an error (' + response.status
      + '). Try a simpler keyword or retry later.'
    );
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];

  if (reset) {
    results.innerHTML = '';
  }

  if (items.length === 0 && page === 1) {
    results.innerHTML =
      '<div class="empty"><b>No repositories found.</b> '
      + 'Try a broader keyword or another ecosystem.</div>';

    status.textContent =
      'No matching repositories were found. Try different keywords.';
    moreBtn.hidden = true;
    return;
  }

  if (items.length > 0) {
    results.insertAdjacentHTML(
      'beforeend',
      items.map(renderRepository).join('')
    );

    page += 1;
  }

  const displayed =
    results.querySelectorAll('.discovery-card').length;

  const total = Number(data.total_count || 0);

  status.textContent =
    'Showing ' + displayed
    + ' projects from ' + total.toLocaleString()
    + ' matching repositories. Recent activity is a signal to investigate, '
    + 'not proof they are hiring or have a budget.';

  updateMoreButton(items.length);

  if (displayed >= MAX_RESULTS) {
    status.textContent += ' Reached the 100-result display limit.';
    moreBtn.hidden = true;
  }
} catch (error) {
  status.textContent =
    error.message
    || 'Could not reach GitHub. Check your connection and try again.';

  // Keep previously loaded results when a Load more request fails.
  if (results.querySelectorAll('.discovery-card').length === 0) {
    moreBtn.hidden = true;
  }
} finally {
  busy = false;
  searchBtn.disabled = false;
  moreBtn.disabled = false;
}

}

function refreshTrackedStatus() {
  results.querySelectorAll('.discovery-card').forEach(card => {
    const button = card.querySelector('[data-discovery-import]');
    if (!button) return;

    const tracked = isTracked(button.getAttribute('data-discovery-import'));

    button.disabled = tracked;
    button.textContent = tracked
      ? 'Already tracked ✓'
      : 'Track this project';
  });
}

window.addEventListener(
  'gigradar:leads-updated',
  refreshTrackedStatus
);
// Search using the current keywords and ecosystem.
form.addEventListener('submit', event => {
event.preventDefault();
search(true);
});

// Load the next page without discarding current results.
moreBtn.addEventListener('click', () => search(false));

// Send a discovered repository to GigRadar's existing link importer.
results.addEventListener('click', event => {
const button = event.target.closest('[data-discovery-import]');

if (!button) return;

const link = button.getAttribute('data-discovery-import');

const importButton = $('importTop');
const linkInput = $('linkInput');
const checkLink = $('checkLink');

if (!importButton || !linkInput || !checkLink) {
  status.textContent =
    'Open Import link from the overview and paste this repository URL: '
    + link;
  return;
}

importButton.click();

window.setTimeout(() => {
  linkInput.value = link;
  checkLink.click();
}, 100);

});
})();
