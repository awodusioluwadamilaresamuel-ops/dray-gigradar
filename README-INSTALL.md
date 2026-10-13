# GigRadar Phase B — Source Discovery

This bundle adds browser-based discovery for public GitHub repositories.

## Files
- `discovery.js` — queries GitHub's public repository Search API, renders project cards, and hands a selected repository into GigRadar's existing link importer.
- `discovery.css` — responsive styling for the discovery screen.
- `index-snippet.html` — exact UI blocks to add to `index.html`.

## Install on `feature/source-discovery`
1. Upload `discovery.js` and `discovery.css` to the repository root on the `feature/source-discovery` branch.
2. Edit `index.html` on that branch:
   - Add the stylesheet link inside `<head>` after `v1.css`.
   - Add the Discover nav button inside `<nav class="nav">` after Overview.
   - Add the `view-discovery` section inside `<main class="main">` before `view-leads`.
   - Add `<script src="discovery.js"></script>` after the existing `app.js` script.
3. The matching HTML blocks are in `index-snippet.html`.

## Limitations
- This discovers active public repositories, not verified paid gigs.
- It does not scrape X or infer that a project is hiring.
- Search API rate limits apply. The app uses no API key and makes requests only when the user clicks Search.
- Existing leads and localStorage data are untouched.
