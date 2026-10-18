# Bee — team development starter

This is the source of the current public Bee demo. Interface language: English.

## Run locally

Install Python 3, then run from this folder:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8080. No build step, account, API key or paid service is needed. Browser microphone features require localhost or HTTPS.

## Source map

- `dist/app.js`: session setup, questions, audio, marking, local persistence.
- `dist/styles.css`: layout, typography, colors, responsive styles.
- `dist/bee.svg`: mascot artwork.
- `dist/index.html`: entry document.
- `dist/scope.html`: capabilities and honest limitations.
- `dist/vendor/`: bundled PDF.js and its license; keep attribution.

## Work together

1. A team owner creates a private GitHub repository and uploads this folder, preserving its structure.
2. The owner invites each teammate with repository write access. Never share account passwords or API keys.
3. Each person clones the repository and creates a branch for one change, for example `feature/session-review` or `design/mobile-layout`.
4. Agree who edits `app.js` and `styles.css` before overlapping work; both currently contain much of the app.
5. Commit and push your branch, then open a pull request. Another teammate reviews behavior and screenshots before merging.
6. One release owner publishes the approved version and checks it in a signed-out browser. Merging this repository does not automatically update the existing Sites deployment.

The existing hosted source repository and its deployment credentials are intentionally not included. To connect a new team repository to deployment, choose and configure a hosting workflow explicitly. This package does not grant editing access to the current hosted project.

## Before merging

- Complete a session with custom questions and notes; reload and confirm persistence.
- Test examiner marking and weak-question drill.
- Check desktop and narrow mobile widths, keyboard navigation and focus visibility.
- Verify PDF/TXT upload and microphone-denied fallback to typing.
- Check optional recording playback and deletion on localhost/HTTPS.
- Do not invent scores or claim AI is enabled.

## Current boundaries

Manual practice, browser speech, local recording, examiner-entered marks and local history work. AI generation/grading, accounts, shared student data and remote examiner sessions are not enabled. Data lives in each browser; source collaboration does not make student data collaborative. Speech recognition can depend on a browser vendor service. Audio is stored in IndexedDB.

Research-driven feature and design upgrades are still pending; this package represents the existing app, not a completed upgrade release.
