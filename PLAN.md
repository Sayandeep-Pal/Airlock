# Airlock — Build Plan (#BuildHybridAI 2026)

> Paste or upload a sensitive document. Personal data is stripped **on your device**, only the cleaned text goes to the **cloud** for the hard reasoning, and the answer is restored with your real details, **on your device**.

- **Deadline:** Nov 30, 2026, 2:00 pm PT (22:00 UTC). Plan to submit early.
- **Target:** Web app on Chrome with Gemini Nano, using the Firebase AI Logic hybrid inference SDK.
- **Prize tracks:** Overall (1st/2nd/3rd) and Best Web App.
- **Judging:** Implementation, Design, Impact and Originality, weighted equally.
- **Rules:** [firebasehybridaihackathon.devpost.com/rules](https://firebasehybridaihackathon.devpost.com/rules). Re-check them before submitting.

## Pipeline

| Step | Where | What happens |
|---|---|---|
| 1. Load | Device | Paste text, or upload a PDF (text extracted locally with pdf.js) |
| 2. Detect | 🔒 Device | Fixed pattern rules plus Gemini Nano find personal data and swap it for tokens like `[PERSON_1]` or `[ACCOUNT_2]` |
| 3. Review | Device | The user sees highlighted items and can switch any of them on or off |
| 4. Airlock check | 🔒 Device | The cleaned text is scanned again; nothing is sent until it passes. The user sees the exact text that will leave |
| 5. Reason | ☁️ Cloud | Gemini Flash explains the document in plain language, lists next steps and drafts a reply, keeping tokens as they are |
| 6. Restore | 🔒 Device | Tokens are swapped back with plain text replacement, no model, so nothing can be invented |
| 7. Trust log | Device | A record of exactly what left the device, when, and how large it was |

### How each inference mode is used
- **`ONLY_ON_DEVICE`:** detection and the airlock check. This is the privacy guarantee. With no Nano, the SDK throws instead of falling back to the cloud.
- **`ONLY_IN_CLOUD`:** reasoning. It only ever receives cleaned text.
- **`PREFER_ON_DEVICE`:** the "quick summary" feature. It works offline and switches to the cloud when Nano is missing.
- **No Nano on the machine:** never send raw text quietly. Fall back to pattern rules only, show a clear warning, and require explicit consent.

## Tech stack
- **App:** Vite, React and TypeScript, hosted on Firebase Hosting.
- **AI:** the `firebase/ai` package, with separate model setups per mode. The app picks the route itself, so the 🔒/☁️ badges are always accurate.
- **App Check:** reCAPTCHA Enterprise in production, with a debug token for development.
- **Remote Config:** the cloud model name and which kinds of personal data to detect.
- **Deliberately no Firestore:** nothing sensitive is stored anywhere.
- **Stretch:** a Chrome extension version.

## Detection engine
1. **Pattern rules:** emails, phone numbers, card numbers (with a checksum), IBANs, US Social Security numbers, Indian Aadhaar and PAN numbers, dates of birth, postcodes.
2. **Nano:** names, addresses, organisations, patient and case IDs. Output is forced into a fixed JSON format. Long documents are split into chunks to fit Nano's context limit.
3. **Merge:** results from both are combined, with the same item always getting the same token.
4. **Recheck:** pattern rules run again on the cleaned text. If anything is left, the airlock stays shut.
5. **Test set:** about 20 made-up documents (medical, legal, tax, HR) with every piece of personal data labelled. Measure how many items are caught and publish the number in the README.

## Schedule

| Dates | Work |
|---|---|
| Nov 15–16 | Register on Devpost. Enable Nano in Chrome (flags or origin trial). Firebase project, App Check, test calls in each mode. Check whether the SDK reports where a response actually ran |
| Nov 17–19 | Detection engine and the test set |
| Nov 20–21 | Review screen, airlock check, cloud call, restore step: a full working path |
| Nov 22–23 | No-Nano fallback, offline quick summary, trust log, Nano download progress screen |
| Nov 24–25 | Design polish, PDF upload, ready-made tasks ("Explain my medical report", "Reply to this legal notice") |
| Nov 26 | Run the test set, tune prompts, deploy to Hosting |
| Nov 27 | Fix bugs. **No new features after this** |
| Nov 28 | Script and record the demo video |
| Nov 29 | README with an architecture diagram, Devpost write-up, Apache license |
| Nov 30 | Submit early |

## 3-minute demo outline
1. **0:00–0:20.** The problem: "You want AI to explain your medical report, but you'd be uploading your whole identity."
2. **0:20–1:30.** Live run on a fake medical bill: items highlighted on the device, airlock check passes, the network tab shows only tokens leaving, and the explanation comes back with real names restored.
3. **1:30–2:10.** Hybrid in action: offline quick summary still works, and the no-Nano browser uses the safe fallback.
4. **2:10–2:40.** Architecture diagram and the detection score from the test set.
5. **2:40–3:00.** Who it helps: patients, tenants, employees, anyone handling sensitive paperwork.

## Risks

| Risk | Mitigation |
|---|---|
| Nano misses some names | Pattern rules as a backstop, user review step, tuning against the test set |
| Nano takes minutes to download | Warm-up screen at first launch. Record the demo on a machine where it's already downloaded |
| Judges don't have Nano | The no-Nano mode still runs the whole flow. Say so clearly in the README |
| Details that identify someone indirectly (rare diagnosis plus a date) | List as a known limitation. Offer an option to blur dates to "month and year" |
| Rules forbid real personal data | Use made-up documents only, everywhere |

## Submission checklist
- [ ] Public GitHub repo with an Apache-2.0 license
- [ ] Real AI calls through Firebase AI Logic, plus setup and run instructions
- [ ] App Check integrated (a debug token is OK)
- [ ] English UI and English project description, including the hybrid design
- [ ] Public YouTube demo, 3 minutes or less
- [ ] No secrets or real personal data in the code or demo
