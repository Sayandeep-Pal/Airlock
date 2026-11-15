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
| Gemini Nano detection (names, addresses, orgs, IDs) | ✅ Done (one prompt tuning round; re-score pending) |
| Test set (20 synthetic docs) and scoring, in tests and in the browser | ✅ Done |
| Developer "lab" UI (status, route test, redaction preview, score table) | ✅ Done |
| **Main Airlock flow:** review → airlock check → cloud answer → restore | ⬜ Not started. **Highest priority** |
| No-Nano safe mode with consent | ⬜ Partly done: detection falls back and reports the error; no UI or consent yet |
| Offline quick summary (`PREFER_ON_DEVICE`) | ⬜ Not started |
| Trust log | ⬜ Not started |
| Product-quality UI (lab moves to an "Under the hood" tab) | ⬜ Not started |
| PDF upload, ready-made tasks, "Try a sample" | ⬜ Not started |
| Remote Config, date-blurring option | ⬜ Not started (nice to have) |
| Production deploy (Hosting, reCAPTCHA Enterprise, App Check enforced) | ⬜ Not started |
| README, architecture diagram, demo video, Devpost write-up | ⬜ Not started |

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
- **Tests:** `npm test` runs 24 tests. They cover checksums, patterns, the vault round trip, chunking, parsing, locating, merging, `detectPii` with a fake Nano, dataset integrity, and a guard that patterns catch 100% of pattern-type items.

### Results log

| Run | Recall | Precision | Notes |
|---|---|---|---|
| Patterns only (after TAN rule) | 36.1% | 100% | Misses every PERSON, ORG and ADDRESS |
| Patterns + Nano, run 1 (before tuning) | 97.0% | 96.9% | Missed: Deepa Menon, Peter Novak, "OS 1482/2026", TAN. Extras: job titles, "Marketing", IRS |
| Patterns + Nano, after tuning | *pending* | *pending* | Run twice. Check the old misses are fixed and nothing regressed. If it regressed, trim the prompt |

### Observed behaviour
- Nano's first call takes about 7 seconds while the model loads; later calls take about 2 seconds. A full Nano scoring run takes about 94 seconds for 20 docs.
- Nano answers open questions badly; it confused "hybrid AI" with mixing AI techniques. This supports the design: Nano does narrow extraction only, and reasoning goes to the cloud.
- The first cloud call took 178 seconds right after the App Check debug token was fixed. Probably App Check backoff after earlier 401s; still unconfirmed. If cloud calls stay slow, check the thinking settings or the model choice.

---

## What's left

### 1. Main Airlock flow (highest priority)
The product screen, separate from the lab:
1. **Input:** paste text, or pick a sample.
2. **Detect:** call `detectPii` with Nano. Show progress, and warm Nano up early so the ~7 second first call isn't felt.
3. **Review:** highlight each item (reuse `Highlighted`) and let the user switch it on or off. Switching an item off removes it from the spans. Allow adding a missed item by selecting text.
4. **Airlock check:** call `findLeaks` on the outgoing text. **The send button is disabled until it's clear.** Show the exact outgoing text, a character count and the token count.
5. **Cloud task:** call `run('cloud', prompt)`. Tasks:
   - "Explain in plain language"
   - "What should I do next?"
   - "Draft a reply"
   
   Prompt rules: keep every `[TYPE_N]` token exactly as written, never guess the real values, and use simple language.
6. **Restore:** apply `restore` to the answer, then render it as markdown (cloud output uses `**bold**`). Show a toggle between the restored and the tokenised view.
7. **Badges:** show 🔒/☁️ on every step, from real `where` values.

### 2. No-Nano safe mode
- When Nano is unavailable or `detectPii` returns `usedNano: false`, show a clear warning: "Only pattern rules ran: names and addresses may not be hidden."
- Require an **explicit consent checkbox** before sending.
- **Never send raw text silently.**
- Encourage marking items by hand in this mode.
- Judges likely lack Nano, so this path must feel polished, not broken.

### 3. Offline quick summary
- A "Quick summary" button using `run('prefer-device', …)`. It works offline when Nano is present and uses the cloud when Nano is missing.
- **Privacy rule:** only ever pass it the **redacted** text, or keep it on-device only when the text isn't redacted.
- Show the real `where` badge.

### 4. Trust log
- A list of every request that left the device: time, task, character count, token count, and the exact text sent.
- **Memory only.** Nothing is stored or uploaded. Cleared on reload.

### 5. Product UI and design
- Main screen: the Airlock flow. A second tab, "Under the hood": the current lab (status, route test, score table).
- Visual polish:
  - a clear step indicator (Detect → Review → Send → Answer)
  - the trust meter
  - good empty and loading states
  - works at phone width
  - light and dark themes, which already exist
- A short "How to try it" box for judges: enable the Chrome flag, or use safe mode.

### 6. Inputs and tasks
- **PDF upload:** extract text locally with pdf.js. **Never upload the file.**
- **"Try a sample" button:** synthetic documents from the dataset.
- **Ready-made tasks** by document kind (medical, legal, tax, HR, housing, insurance).

### 7. Nice to have
- Remote Config for the cloud model name and which types to detect.
- A "blur dates" option that turns dates into month and year, against indirect identification.
- A Chrome extension version (stretch).

### 8. Release
- **Production App Check:** reCAPTCHA Enterprise key with domains `localhost`, `<id>.web.app` and `<id>.firebaseapp.com`. Enforce App Check for AI Logic in the console.
- **Deploy:** `firebase login`, `firebase use <project>`, then `npm run deploy`.
- **Confirm the cloud model ID.** `gemini-3.8-flash` in `.env.local` is a placeholder from conflicting docs, though it works.
- **Clean up package managers:** stray `pnpm-lock.yaml` and `pnpm-workspace.yaml` exist and are uncommitted. Ask the user to choose npm or pnpm, then remove the other lockfile.

### 9. Submission materials
- **README:** pitch, GIF of the flow, architecture diagram, routing table, detection scores, setup steps, how judges can try it without Nano, known limitations (indirect identifiers, Nano variance).
- **Architecture diagram:** device side (patterns, Nano, vault, airlock check, restore) and cloud side (Gemini via AI Logic), with App Check on the boundary.
- **Demo video:** 3 minutes or less, captioned, outline below.
- **Devpost write-up:** Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next. Map it to the four judging criteria. Include a cover image and 4–5 screenshots.
- Write the video script and the write-up **after** the flow is built, so they describe what really exists.

---

## Demo video outline (3 minutes or less)
1. **0:00–0:15. Problem:** "I wanted AI to explain my medical bill, but I'd be uploading my identity."
2. **0:15–0:30. One-line pitch** on the Airlock home screen.
3. **0:30–1:30. Main demo:** highlights with 🔒 badges, then the DevTools Network tab showing only tokens leave, then the answer with real names restored.
4. **1:30–2:00. Hybrid:** Wi-Fi off and the quick summary still works; a no-Nano browser shows the safe mode with consent.
5. **2:00–2:30. Proof:** the architecture diagram, and the score table (36% → 97%).
6. **2:30–3:00. Impact:** patients, tenants, employees. Closing line.

## Risks

| Risk | Mitigation |
|---|---|
| Nano misses items | Pattern backstop, user review step, eval-driven prompt tuning |
| Nano's first-load delay | Warm up early, show progress, record the demo on a warmed-up machine |
| Judges lack Nano | A polished safe mode, a "Try a sample" button, clear instructions in the README and on the page |
| Indirect identifiers | Document as a limitation; offer date blurring |
| Prompt tuning regresses other cases | Re-run the full score after every prompt change; log results in the table above |
| Real personal data in the repo or demo | Synthetic data only; `.env.local` git-ignored; `.env.example` stays blank |

## Submission checklist
- [ ] Public GitHub repo with an Apache-2.0 license (repo exists: `Sayandeep-Pal/Airlock`; push regularly)
- [x] Real AI calls through Firebase AI Logic
- [ ] Setup and run instructions final in the README
- [x] App Check integrated (debug token in dev)
- [ ] App Check in production mode and enforced
- [ ] English UI and English project description, including the hybrid design
- [ ] Public YouTube demo, 3 minutes or less
- [ ] Live deployed link
- [x] No secrets or real personal data in the code or demo so far
