# JKSpeak — Oral Exam Practice

A browser-based workspace for university oral exams, Viva / oral defence and presentation Q&A. The account-onboarding integration adds xiulin wang’s splash/welcome/login screens, real Supabase auth and a learning profile. Interface and prompts are in English.

## Run locally

Python 3 is the only runtime dependency. From this checkout:

```sh
python3 scripts/serve.py --port 8080
```

The server binds to `127.0.0.1` by default and serves only public app assets, including the bundled PDF.js modules. No build or package installation is required. Actual signup/login requires a configured Supabase project and the SQL migration. The public project URL and publishable key are configured. The owner confirmed SQL/Auth redirect setup; provider health, email-confirmation settings and anonymous profile access denial were checked. Actual confirmation/recovery email delivery and first-account use still need a real-user check. Account forms remain disabled if public configuration is absent. See [account onboarding setup](docs/Account-Onboarding.md). Microphone features need localhost or HTTPS and browser permission. Hosting this elsewhere requires a separate deployment workflow.

## Entry and accounts

`index.html` / `splash.html` → `welcome.html` → `signup.html` (account → six short profile questions → review → `confirm-email.html`) or `login.html` → `app.html`. All screens share the splash’s 420px canvas, with full-width mobile layout. Email-confirmation links return to login, validate the session and open the app; used/expired links leave login usable with a link to request a fresh email; a missing profile is completed in `profile.html`. Recovery/reset pages are included. Accounts have separate device-local practice stores, and earlier unassigned data is copied only with explicit confirmation. Never put a service-role/secret key in the public JSON.

## Practice workflow

- Choose an exam format, one focus skill and Guided (optional hints/notes) or Mock (no hints/notes).
- Add text-based PDF, TXT or Markdown, study notes, rubric and your own questions; format starter prompts are also available.
- Practise by typing, optional browser dictation or local audio recording. Interrupted sessions resume paused.
- Review exact passages of your answer, flag a skill for practice, retry one answer and compare with the original, or transfer the skill to a different authored prompt.
- In Guided practice, add an authored follow-up challenge quoting your answer. This is a fixed scaffold, not an AI examiner.
- Progress separates your self-review, confidence and human examiner marks. Suggestions use your explicit evidence-linked flags; they do not infer grades or ability.
- Set a session goal for the last seven days and track review, retry and transfer actions without treating activity as ability.
- Settings provides a light/dark theme, text export and complete local-data deletion. Recordings can be downloaded or deleted individually from answer reviews.

No AI examiner, automatic grading, official language-exam scoring, practice-data cloud sync or remote examiner is connected. Supabase account/profile support is implemented but requires a real project configuration before activation. Dictation may use your browser vendor’s speech service and asks before starting. Recordings stay in account-scoped IndexedDB; practice text stays in account-scoped localStorage. The learning profile is stored in Supabase, and auth tokens stay in the tab’s sessionStorage. People sharing a browser profile can see the same records. Exports exclude audio; download recordings separately.

## Source map

- `auth-client.mjs`, `auth-pages.mjs`, `profile-fields.mjs`, `learning-profile.mjs`, `account-data.mjs`: authentication, minimal learning profile, opt-in AI context and account-scoped legacy import.
- `auth-config.json`: public project URL and publishable key only.
- `supabase/migrations/202610180001_learning_profiles.sql`: profile validation, signup trigger and own-account RLS.
- `auth.css`, `avatar.png`, entry/account HTML pages: integrated from xiulin wang’s PR #1.

- `app.js`: setup, practice, review, media, persistence and UI.
- `oral-coach.mjs`: authored format prompts, skills, transparent next-focus selection and retry comparison.
- `styles.css`, `index.html`, `jkspeak-mark.svg`, `logo.png.png`, `scope.html`: interface and capability/privacy information.
- `pdf.mjs`, `pdf.worker.mjs`, `PDFJS-LICENSE.txt`: bundled PDF.js; preserve attribution.
- `scripts/serve.py`: public-asset-only development server.
- [Update audit and JKSpeak colour palette](docs/JKSpeak-Update-Audit.md): implemented features and explicit remaining server requirements.
- [Adapted design and implementation scope](docs/JKSpeak-Oral-Exam-Design.md): Korean product/implementation notes.

## Validate

With Node.js installed:

```sh
node --check app.js
node --test tests/oral-coach.test.mjs tests/learning-profile.test.mjs
```

Browser regression requires Python Playwright and Chromium. Start the test server in another terminal:

```sh
python3 scripts/serve.py --port 8081
python3 tests/browser_smoke.py
python3 tests/deployment_smoke.py
JKSPEAK_TEST_URL=http://127.0.0.1:8081 python3 tests/auth_browser.py
JKSPEAK_TEST_URL=http://127.0.0.1:8081 python3 tests/auth_links_browser.py
JKSPEAK_TEST_URL=http://127.0.0.1:8081 python3 tests/account_layout_browser.py
python3 tests/profile_rls.py
```

The test defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation or `JKSPEAK_TEST_URL` for another server. It covers legacy data, uploaded text, session recovery, guided/mock modes, evidence validation, per-answer retry comparison, human marks, learning focus, confidence, theme persistence, export, microphone fallback, mobile layout and complete deletion. It uses an isolated browser profile and synthetic practice data.

Before release, also check keyboard navigation, 200% zoom, PDF extraction, real microphone playback/deletion, transcription errors and Safari/Firefox. Do not commit recordings, study data or credentials. Source changes do not automatically update the hosted deployment. See CONTRIBUTING.md for collaboration requirements.

The auth browser tests use intercepted provider responses and synthetic credentials. SQL/RLS tests run real PostgreSQL in an isolated Docker container. Neither proves live Supabase email delivery or a configured production deployment. Keep first-account and real email-delivery checks distinct from provider configuration and mock-flow validation.

Entry scripts/styles carry an `flow-20261018-2` URL version to prevent browsers reusing the pre-account app bundle after this rollout. Bump the entry asset version when changing those bundles in a later release.
