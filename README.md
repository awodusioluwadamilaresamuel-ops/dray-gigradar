# Dray GigRadar V0

A mobile-friendly Web3 gig-hunting dashboard for tracking projects, outreach, pipeline stages, follow-ups, and payments.

## Files
- `index.html` — app structure
- `styles.css` — responsive dark/lime interface
- `app.js` — lead management and browser storage

## Run locally
Open `index.html` in a modern browser. No build step or package installation is required.

## Deploy on Netlify
1. Push these files to the root of the `dray-gigradar` GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Connect GitHub and select `dray-gigradar`.
4. Leave the build command blank and set the publish directory to `.` (the repository root).
5. Deploy.

## Important data note
This first version stores records in browser `localStorage` on the device/browser where they were entered. It does not sync between devices and clearing browser data can remove records. A future version can add a database and authentication.

## Suggested workflow
1. Add a project only after noting a real opportunity or gap.
2. Record a relevant contact, potential service, and next action.
3. Move its status as outreach progresses.
4. Set a follow-up date.
5. Mark work `Won`, record the agreed value, and update payment status when paid.
