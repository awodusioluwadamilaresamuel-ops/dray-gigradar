Dray GigRadar V1 (Stage 1: stabilize)
A mobile-friendly Web3 gig-hunting dashboard for tracking projects, outreach, pipeline stages, follow-ups, and payments. One responsive layout serves phone and PC, with dark and light themes.
Files
index.html: app structure
styles.css: original dark/lime interface (unchanged from V0)
v1.css: light theme, new component styles, accessibility focus styles
store.js: data rules (validation, duplicate detection, V0 upgrade, export/import). Has no screen code, so it can be tested alone
app.js: screens and interactions
tests/store.test.js: automated checks for store.js (run with node tests/store.test.js)
Run locally
Open index.html in a modern browser. No build step or package installation is required.
Deploy on Netlify
Same as V0: push all files to the repository root, leave the build command blank and set the publish directory to ..
Every file listed above must be uploaded, including the new v1.css and store.js.
What changed in Stage 1
Existing V0 records load unchanged. They use the same storage key (dray-gigradar-v1), and a one-time untouched copy is also kept under dray-gigradar-pre-v1-copy.
New optional fields: Website and Project X profile. Both are validated and stored in a normalized form.
Duplicate protection: a project is blocked if another has the same website, the same X profile, or the same name on the same chain.
Backup panel on Overview: Export backup downloads a JSON file; Import backup merges one in without deleting anything and without creating duplicates.
If saved data is ever unreadable, the app keeps the raw text, shows a notice, and offers a recovery download instead of silently starting empty.
Save failures now show an error instead of "Saved".
Overdue follow-ups are flagged. The pipeline chart now includes all 6 stages.
Dark/light toggle in the top bar. The choice is remembered on the device.
Important data note
Records are stored in browser localStorage on the device and browser where they were entered. They do not sync between devices, and clearing browser data removes them. Export a backup regularly. Moving data between phone and PC works by exporting on one and importing on the other.
Suggested workflow
Add a project only after noting a real opportunity or gap.
Record a relevant contact, potential service, and next action.
Move its status as outreach progresses.
Set a follow-up date.
Mark work Won, record the agreed value, and update payment status when paid.
