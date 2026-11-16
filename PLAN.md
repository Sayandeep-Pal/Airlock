# Airlock: Plan & Progress (#BuildHybridAI 2026)

> Paste or upload a sensitive document. Personal data is stripped **on your device**, only the cleaned text goes to the **cloud** for the hard reasoning, and the answer is restored with your real details, **on your device**.

- **Target:** Web app on Chrome with Gemini Nano, using the Firebase AI Logic hybrid inference SDK.
- **Prize tracks:** Overall and Best Web App.
- **Judging:** Implementation, Design, Impact and Originality, weighted equally.
- **Core pitch:** the split between device and cloud **is** the privacy feature. It isn't a fallback.

---

## Progress at a glance

| Area | Status |
|---|---|
| Project setup, Firebase, App Check, hybrid model routing | ✅ Done |
| Pattern-based detection (emails, cards, IDs, phones, dates…) | ✅ Done |
| Detection: patterns + Gemini Nano + deterministic backstops | ✅ Done: 99–100% recall, ~97% precision with Nano; 82.7% / 100% without |
| Test set (20 synthetic docs) and scoring, in tests and in the browser | ✅ Done |
| Developer "lab" UI (status, route test, redaction preview, score table) | ✅ Done |
| **Main Airlock flow:** review → airlock check → cloud answer → restore | ✅ Done; browser-tested (38/38 e2e checks with real Nano, cloud mocked) |
| No-Nano safe mode with consent | ✅ Done; browser-tested |
| Offline quick summary (`PREFER_ON_DEVICE`) | ✅ Done; tested offline with real Nano |
| Trust log | ✅ Done; verified it matches exactly what was sent |
| Product-quality UI (lab moves to an "Under the hood" tab) | ✅ Done: how-it-works strip, "How to try it" box, footer, favicon, spinners, copy button, inline keyboard-accessible highlights |
| PDF upload, ready-made tasks, "Try a sample" | ✅ Done: pdf.js on-device, drag-and-drop, bundled synthetic sample PDF; browser-tested |
| Remote Config, date-blurring option | ✅ Done: `cloud_model` parameter (optional; default from env); "Send dates as month & year" switch |
| Production deploy (Hosting, reCAPTCHA Enterprise, App Check enforced) | 🟨 Config ready (`firebase.json` with security headers); **needs the user**: `firebase login`, reCAPTCHA key, deploy, enforce |
| README, architecture diagram, demo video script, Devpost write-up | ✅ Written: [README.md](README.md), [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), [docs/DEVPOST.md](docs/DEVPOST.md). **User still records the video** |
| Real cloud answers (quality, latency, placeholder handling) | ⬜ **Needs the user's browser** (its App Check debug token is registered) |

---

## What's done (with locations)

### Setup
- **Stack:** Vite, React 19, TypeScript 7, Firebase JS SDK 13 (`firebase/ai`), Vitest. Package manager is npm (`package-lock.json`).
- [src/firebase.ts](src/firebase.ts): initialises the app, App Check and AI Logic (`GoogleAIBackend`, the Gemini Developer API).
  - **App Check:** in dev with `VITE_APPCHECK_DEBUG_TOKEN`, it sets `FIREBASE_APPCHECK_DEBUG_TOKEN` on `globalThis`. Otherwise it uses `ReCaptchaEnterpriseProvider`.
  - Exports `firebase` (null when `.env.local` is missing) and `CLOUD_MODEL`.
- **Config:** `.env.local` (git-ignored) holds the real values. `.env.example` is the blank template; **never put real values in it**.
- **Licence and hosting:** Apache-2.0 `LICENSE`. `firebase.json` sets up Hosting for `dist/` with an SPA rewrite.

### Hybrid routing
[src/ai/models.ts](src/ai/models.ts) has a `run(route, prompt, onDeviceParams?)` function with three routes:

| Route | SDK mode | Used for |
|---|---|---|
| `device` | `ONLY_ON_DEVICE` | Detection. Throws if Nano is unavailable; never falls back to the cloud |
| `cloud` | `ONLY_IN_CLOUD` | Reasoning over cleaned text |
| `prefer-device` | `PREFER_ON_DEVICE` | Offline quick summary |

- `run` returns `{ text, where, ms }`. `where` comes from the SDK's `response.inferenceSource`, so the badges are real data.
- `warmUpDeviceModel(onProgress)` wraps `initializeDeviceModel`. It **must be called from a user gesture**.
- [src/ai/nano.ts](src/ai/nano.ts): checks Chrome's `LanguageModel.availability()` and holds help text for each status.
- [src/ai/nanoPrompt.ts](src/ai/nanoPrompt.ts): `promptNanoForJson()` runs on-device with `responseConstraint: ENTITY_SCHEMA`, and **refuses if the result didn't run on-device**.
  - It lives in its own file so tests never import Firebase. Importing `firebase.ts` in tests reads `.env.local` and crashes.

### Detection pipeline (all on-device)
- [src/redact/patterns.ts](src/redact/patterns.ts): `detectPatterns(text)` finds the following, with overlap priority by detector order:
  - EMAIL, IBAN (mod-97), CARD (Luhn), SSN, AADHAAR (Verhoeff), PAN, Indian TAN (as ID), PHONE (10–15 digits), DATE (several formats).
  - Postcodes are deliberately **not** pattern-matched: they cause too many false matches on amounts. Nano finds them inside addresses.
- [src/redact/nano.ts](src/redact/nano.ts): Nano detects the types PERSON, ADDRESS, ORG and ID.
  - `buildPrompt` holds the tuned prompt.
  - `chunkText` splits at 1200 characters, breaking on lines.
  - `parseEntities` is a lenient JSON reader.
  - `locateEntities` matches each item verbatim, ignoring whitespace differences and letter case, with word boundaries. **Items not in the text are dropped**, so Nano can't invent spans. Person names also match their capitalised parts (surname alone).
- [src/redact/merge.ts](src/redact/merge.ts): overlapping spans become their **union**, taking the type of the longest member, so a partial overlap can't leak the rest of the text.
- [src/redact/detect.ts](src/redact/detect.ts): `detectPii(text, { useNano, prompt })` combines patterns and Nano. If Nano fails it returns pattern-only spans with `usedNano: false` and `nanoError`.
- [src/redact/vault.ts](src/redact/vault.ts):
  - `redact` swaps items for stable tokens like `[PERSON_1]`; the same type and value always gets the same token.
  - `restore` uses plain string replacement; unknown tokens are left as they are.
  - `findLeaks` is the airlock re-scan: patterns, plus any vault value appearing verbatim.

### Evaluation
- [src/eval/dataset.ts](src/eval/dataset.ts): 20 synthetic documents (medical, legal, tax, HR, housing, insurance) with labels.
  - **Labelling rule:** government bodies, courts, tax authorities, job titles and departments are *not* personal data.
- [src/eval/score.ts](src/eval/score.ts):
  - **Recall:** a labelled occurrence counts as caught when 90% or more of its characters are covered, whatever type it was given.
  - **Precision:** the share of spans that overlap any label.
- **Tests:** `npm test` runs 55 tests (run it from PowerShell or cmd; in Git Bash, Vitest 5 fails every suite with "Cannot read properties of undefined (reading 'config')" because the drive letter is spelled `/c/` vs `C:`). They cover checksums, patterns, the vault round trip, chunking, parsing, locating, merging, `detectPii` with a fake Nano, dataset integrity, and a guard that patterns catch 100% of pattern-type items.

### Results log

| Run | Recall | Precision | Notes |
|---|---|---|---|
| Patterns only (after TAN rule) | 36.1% | 100% | Misses every PERSON, ORG and ADDRESS |
| Patterns + Nano, run 1 (before tuning) | 97.0% | 96.9% | Missed: Deepa Menon, Peter Novak, "OS 1482/2026", TAN. Extras: job titles, "Marketing", IRS |
| Patterns + Nano, after prompt tuning (Claude's test browser) | 97.0% / 97.7% | 98.4% | 2 runs. Prompt fixes held, but Nano still varies: names and orgs missed in some runs |
| Patterns only, with name/code/org rules | **82.7%** | **100%** | Title, label, signature and reference-code rules, the org-ending rule (incl. ALL-CAPS), and `propagate()` |
| Patterns + Nano, with the rules above | **100.0% / 99.2%** | 97.0% / 97.7% | 2 runs. Only extras: IRS, HM Revenue & Customs, "CP2000", "2025" (public bodies and a notice code) |
| Patterns + Nano, after sign-off and field-word rules | **100.0%** | 97.7% | 1 run. Patterns-only unchanged at 82.7% / 100% |

### Observed behaviour
- Nano's first call takes about 7 seconds while the model loads; later calls take about 2 seconds. A full Nano scoring run takes about 94 seconds for 20 docs.
- Nano answers open questions badly; it confused "hybrid AI" with mixing AI techniques. This supports the design: Nano does narrow extraction only, and reasoning goes to the cloud.
- The first cloud call took 178 seconds right after the App Check debug token was fixed. Probably App Check backoff after earlier 401s; still unconfirmed. If cloud calls stay slow, check the thinking settings or the model choice.

---

## What's left

### 0. Main flow: built and browser-tested ✅
**Browser testing setup** (the e2e scripts live outside the repo, in the session scratchpad):
- Real Chrome 157 on an **isolated test profile**. Never the user's profile.
- That profile holds a copy of the Nano model (`OptGuideOnDeviceModel`) and only the Nano-related `Local State` keys: `browser.enabled_labs_experiments`, `optimization_guide.on_device`, `optimization_guide.model_execution.manifest_asset_ledger`, and the `updateclientdata.apps.fklghjjljmnfjoepjmlobpekiapffcja` component entry.
- Chrome is launched manually with `--user-data-dir` and `--remote-debugging-port`, and Playwright attaches over CDP.
  - **Don't use** `launchPersistentContext`: its default flags stop the on-device service from starting.
  - **Never use** `ignoreDefaultArgs: true`: it drops `--user-data-dir`, and Chrome hands off to the user's running browser.
- Cloud calls are intercepted with `ctx.route('**/firebasevertexai.googleapis.com/**')`. The test browser's App Check debug token isn't registered, so this lets the test inspect exactly what would be sent.
- Nano in the test profile is much slower than in the user's normal Chrome: about 20+ seconds per document vs about 5 seconds. Use the user's runs for timing claims.
- Don't edit `src/` while a browser test runs: Vite hot-reloads the page and breaks the run.

**First browser run: 32 of 36 checks passed.** Found and fixed:
- **Layout bug:** the review text box had `min-height: 100%`, which pushed the "Hide" form out of its column, under the task cards, so it couldn't be clicked. Fixed with flex columns.
- **Nano misses vary between runs:** Arjun Mehta, Deepa Menon, Rebecca Lyons and CFL-LN-0093312 leaked in one run.
  - **Fix:** deterministic backstops in `patterns.ts`. Names after titles (Dr./Ms./Advocate…), names after field labels or greetings (Taxpayer:, Signed:, Dear…), and reference codes (letters and digits joined by `-` or `/`, with 4+ digits).
  - Plus `propagate()` in `detect.ts`: anything found once is hidden at every other occurrence, including surname-only mentions.
  - Pattern-only recall went from 36.1% to 68.4%, with 100% precision.

**Final state:** 38 of 38 e2e checks pass. One run crashed at start-up, waiting for the Nano status check, and didn't recur; treat it as a flaky start-up and simply retry.
- Also fixed after visual review: the consent text said "on the right", which is wrong on phones; the Quick summary badge was green, meaning on-device, even when it would use the cloud; and a surname alone ("Ms. Raman") now reuses the full name's placeholder, so the cloud sees one person, not two (`tokenOfFullName` in `vault.ts`).
- **Not yet tested for real:** the cloud answers themselves. Their quality, the latency, and how well the model keeps placeholders all need the user's browser, whose App Check debug token is registered, or a debug token registered for the test profile.

**Second round:** 36 of 36, then 34 of 36. Found and fixed:
- **The name rule captured all-caps labels:** "Priya Raman   DOB". Now name words need a lowercase letter and single spaces between them.
- **The label rule used the `i` flag with `u`:** this makes `\p{Lu}` and `\p{Ll}` match both cases, which silently disabled the capitalisation checks. Removed. **Never combine `i` with case-sensitive `\p{…}` classes.**
- **Nano sometimes misses organisations:** added an org rule for capitalised words plus a company ending (Ltd, LLP, Inc, Pvt Ltd, Clinic, Hospital, Pharmacy, Bank…), including ALL-CAPS letterheads. Dash signatures ("— Sarah Kim") count as name labels.
- **Lesson:** never rely on Nano alone for an item type. Nano's misses change from run to run, so every type needs a deterministic backstop where one is possible. Addresses currently rely on Nano only (12/12 in every run so far).

**Third round (PDF, date blur, polish): 53 of 53 e2e checks pass.** The e2e now also covers:
- the sample-PDF button
- the file picker, including the error for an unsupported type
- PDF detection with no leaks
- revealing a full name
- blurring and unblurring dates
- copying the answer
- keyboard toggling of highlights
- highlights rendering inline

Found and fixed:
- **A name on the line after "Sincerely," leaked.** Added a sign-off rule.
- **pdf.js collapsed a column gap**, so "Patient: Daniel Okafor Patient ID" was read as a three-word name.
  - Form-field words (Patient, ID, Date, Address…) now end a name.
  - `cleanEntity` strips them from Nano names.
  - `joinTextItems` keeps wide gaps between pdf.js items as 4 spaces.
- **Clickable highlights were `<button>`s** (inline-block), so a long address rendered as a centred box. They are now `<mark role="button" tabIndex=0>` with Enter and Space handling.
- **Revealing a full name blocked the airlock** because its hidden surname matched inside it. `outgoingLeaks` now allows a leak only when it sits *inside* an occurrence of a revealed value; the same surname anywhere else still blocks.
- **The `npm install` on top of a pnpm-made `node_modules`** created a mixed tree. Rebuilt it with `npm ci`; npm is the package manager.

Code lives in [src/flow/](src/flow/):
- `AirlockFlow.tsx`: the three steps.
- `logic.ts`: `activeSpans`, `findPhrase`, `outgoingLeaks`, `unknownTokens`, `TrustEntry`.
- `tasks.ts`: task list and prompt builder.
- `markdown.ts`: safe Markdown parser; no `innerHTML` anywhere.
- `TrustLog.tsx`: the trust log.
- `useNano.ts`: shared Nano status and warm-up.

The lab now lives in [src/components/Lab.tsx](src/components/Lab.tsx). Both tabs stay mounted, so switching tabs loses nothing.

**Decisions:**
- The airlock check runs on the **full prompt**, not just the document.
- Items the user deliberately reveals are allowed through. Anything else found blocks sending.
- Leak matching is whole-word, so a hidden "Al" doesn't block "Total".
- Nano warms up on the first click or key press in the document box. Chrome requires a user gesture.
- Only cloud requests are written to the trust log. On-device runs send nothing.
- The quick summary only ever receives redacted text.

**To check in the browser:**
- Each sample end to end.
- Clicking items to reveal or hide them; "Hide" for a phrase.
- The airlock blocks when it should.
- Safe mode: Nano flag off, or a non-Chrome browser.
- Quick summary with Wi-Fi off.
- Restored answer vs the "what the cloud saw" toggle.
- Trust log contents.
- Phone-width layout.

### 1. Built since the main flow ✅
All of these are browser-tested with real Nano; see the third round above.
- **PDF and text upload:** [src/input/readFile.ts](src/input/readFile.ts).
  - pdf.js is lazy-loaded into its own chunk; the worker is loaded via Vite's `?url` import.
  - Limits are 15 MB and 30 pages.
  - Clear errors for password-protected, scanned or unsupported files.
- **Sample PDF:** [public/samples/sample-medical-bill.pdf](public/samples/sample-medical-bill.pdf), all made up. It is generated by `node scripts/make-sample-pdf.mjs`. `.gitattributes` marks `*.pdf` as binary so CRLF conversion can't corrupt it.
- **Date blurring:** [src/redact/dates.ts](src/redact/dates.ts) plus `redact(text, spans, { blurDates })`.
  - Blurred dates are written straight into the outgoing text and kept out of the vault.
  - Ambiguous numeric dates such as 03/12/1985 become the year only.
- **Remote Config:** in [src/firebase.ts](src/firebase.ts).
  - `cloudModel()` and `configReady` are used by `run()` for cloud-capable routes.
  - The fetch timeout is 4 s, and failures keep the default.
  - "Under the hood" shows where the model name came from.
- **UI polish:**
  - `HowItWorks` and `TryItBox` in [src/components/HowItWorks.tsx](src/components/HowItWorks.tsx)
  - footer, favicon, spinners, "Copy answer", disclaimer
- **Hosting:** security headers in `firebase.json` (`nosniff`, `no-referrer`, `X-Frame-Options DENY`, `Permissions-Policy`), immutable caching for `/assets`, and a JS content type for `.mjs`.

### 2. Needs the user (can't be done from Claude's side)
1. **Real cloud answers.** In the user's own Chrome, whose debug token is registered, run `npm run dev`. Try the hospital sample and the sample PDF with **Explain it**, **What should I do?** and **Draft a reply**. Check:
   - **answer quality**
   - **latency:** one early call took 178 s; if it stays slow, check the thinking settings or the model
   - **that placeholders are kept:** watch for the "invented placeholder" warning
   - **Then:** capture an answer screenshot as `docs/screenshots/3-answer.png` and add it to the README table.
2. **Production deploy:**
   1. `npx firebase login`, then `npx firebase use --add` and pick the project.
   2. Create a **reCAPTCHA Enterprise** key with the domains `localhost`, `<id>.web.app` and `<id>.firebaseapp.com`.
   3. Register it in App Check for the web app.
   4. Put the site key in `.env.local` as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`. Production builds ignore the debug token: `env.DEV` is false.
   5. `npm run deploy`, then test the live URL in a normal and a no-Nano browser.
   6. **Enforce** App Check for AI Logic in the console.
   7. Put the live link in the README ("Live demo") and in `docs/DEVPOST.md`.
3. **Optional:** in Remote Config, add a string parameter `cloud_model` and publish it.
4. **Confirm the cloud model ID** against the Firebase AI Logic models page. `gemini-3.8-flash` works, but came from conflicting docs.
5. **Delete the stray `pnpm-lock.yaml` and `pnpm-workspace.yaml`.** They are untracked. npm is the package manager, with `package-lock.json` and a clean `npm ci`. Claude's attempt to delete them was blocked by the permission check.
6. **Record the demo video** following [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). Upload it to YouTube as public, 3 minutes or less, and add the link.
7. **Submit on Devpost** using [docs/DEVPOST.md](docs/DEVPOST.md). Fill in its `TODO` items.
8. **`git push`** to `Sayandeep-Pal/Airlock`.

### 3. Optional improvements if time allows
- **Cloud prompt tuning** after seeing real answers, for example how dates and amounts are referred to.
- **More samples** for other countries' ID formats.
- **Persist a "remember my choice" for date blurring** in `localStorage`. Keep it a per-browser convenience only.
- **A Chrome extension version** (stretch).

### Testing notes
- **Unit tests:** `npm test` from PowerShell or cmd; 55 tests.
- **Browser e2e:** the scripts live in the session scratchpad, not the repo: `scripts/e2e.cjs` (53 checks) and `scripts/score.cjs` (in-app Nano scoring).
  - Start Vite on port 5199 first: `npx vite --port 5199 --strictPort`.
  - Stop any leftover Vite process on that port.
  - If the scratchpad is gone, recreate them as described in section 0.

## Demo video
See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md): 2:50, with timestamps, narration and a shot checklist.

## Risks

| Risk | Mitigation |
|---|---|
| Nano misses items | Pattern backstop, user review step, eval-driven prompt tuning |
| Nano's first-load delay | Warm up early, show progress, record the demo on a warmed-up machine |
| Judges lack Nano | A polished safe mode, samples and a sample PDF, a "How to try it" box on the page, instructions in the README |
| Indirect identifiers | Document as a limitation; offer date blurring |
| Prompt tuning regresses other cases | Re-run the full score after every prompt change; log results in the table above |
| Real personal data in the repo or demo | Synthetic data only; `.env.local` git-ignored; `.env.example` stays blank |

## Submission checklist
- [ ] Public GitHub repo with an Apache-2.0 license (repo exists: `Sayandeep-Pal/Airlock`; local commits not pushed yet)
- [x] Real AI calls through Firebase AI Logic
- [x] Setup and run instructions final in the README (add the live link after deploy)
- [x] App Check integrated (debug token in dev)
- [ ] App Check in production mode and enforced
- [x] English UI and English project description, including the hybrid design ([docs/DEVPOST.md](docs/DEVPOST.md))
- [ ] Public YouTube demo, 3 minutes or less
- [ ] Live deployed link
- [x] No secrets or real personal data in the code or demo so far
