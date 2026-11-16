# Devpost submission: Airlock

Paste each section into the matching Devpost field. Fill in the `TODO` items before submitting.

- **Project name:** Airlock
- **Tagline (short description):** Get AI help with your medical, legal and tax documents without giving away your identity. Redact on-device with Gemini Nano, reason in the cloud with Gemini, restore on-device.
- **Platform track:** Web
- **Built with:** firebase-ai-logic, gemini-nano, gemini, firebase-app-check, firebase-remote-config, firebase-hosting, chrome-prompt-api, react, typescript, vite, pdf.js, vitest
- **Links:**
  - Repo: https://github.com/Sayandeep-Pal/Airlock
  - Live demo: `TODO`
  - Video: `TODO`
- **Images:**
  - Cover image: `docs/screenshots/2-review.png`
  - Gallery: `1-input`, `2-review`, an answer screenshot (`TODO`: capture one with a real cloud answer), `4-safe-mode`, `5-phone`

---

## Inspiration

The documents people most need help understanding are the ones they should least share: a hospital bill, a notice to vacate, a tax letter, an HR complaint. People paste them into chatbots anyway, because the stakes are high and the language is hard. Doing that hands a cloud service their name, date of birth, address, patient ID and policy numbers.

We noticed that the *reasoning* a large model does over these documents almost never needs the *identity*. "Why didn't my insurer pay?" can be answered just as well for `[PERSON_1]` as for a real name. Hybrid AI made it possible to act on that: a small model on the device that sees everything, and a large model in the cloud that sees only what it needs.

## What it does

Airlock is a web app with three steps:

1. **Redact on your device.** Paste text, pick a synthetic sample, or open a PDF. The PDF is parsed in the browser and never uploaded.
   - **Gemini Nano**, running in Chrome through Firebase AI Logic in `ONLY_ON_DEVICE` mode, extracts names, addresses, organisations and IDs as constrained JSON.
   - **Deterministic rules** catch emails, phone numbers and dates, plus checksum-validated card numbers, IBANs and national IDs.
   - Every item becomes a stable placeholder such as `[PERSON_1]`.
2. **Review, then send through the airlock.**
   - Your document and *exactly what will leave your device* sit side by side.
   - You can click any item to reveal or hide it, hide any phrase yourself, or blur dates to month and year.
   - An on-device airlock check re-scans the full prompt, and the send button stays locked if anything hidden would leak.
3. **Reason in the cloud, restore on your device.** Gemini (`ONLY_IN_CLOUD`) explains the document, lists next steps with deadlines, or drafts a reply, using only placeholders. Airlock then puts your real details back into the answer locally.
   - A toggle shows what the cloud actually saw.
   - A **trust log** lists every request that left the device, with its exact text.

It stays useful when conditions change:
- **Quick summary** runs on Nano (`PREFER_ON_DEVICE`) and works fully **offline**.
- **On a browser without Nano**, Airlock switches to an honest **safe mode**: pattern rules only, a clear warning about what may slip through, and explicit consent before sending.

## How we built it

- **Firebase AI Logic hybrid inference** (`firebase/ai`, `getGenerativeModel` with `mode`). Every call picks its route on purpose:
  - **Detection:** `ONLY_ON_DEVICE`, so raw text can never fall back to the cloud.
  - **Reasoning:** `ONLY_IN_CLOUD`.
  - **Quick summary:** `PREFER_ON_DEVICE`.
  - The UI badges come from the SDK's real `inferenceSource`.
- **Constrained output on the device.** `onDeviceParams.promptOptions.responseConstraint` makes Gemini Nano return JSON, and every entity is located verbatim in the text. Anything Nano invents is discarded.
- **Defence in depth on the device.**
  - Pattern rules with Luhn, mod-97 and Verhoeff checks.
  - Name rules after titles, field labels and sign-offs.
  - A company-suffix rule.
  - Overlapping spans are merged as their union.
  - Anything found once is hidden everywhere it occurs, and a surname alone shares the full name's placeholder.
- **The airlock check** runs `findLeaks` on the *entire* outgoing prompt, combining pattern detection with whole-word matches of every vault value.
- **Prompt-injection guard.** The document is fenced as data, and the model is told to keep placeholders and never guess what's behind them. Invented placeholders are flagged to the user.
- **The Firebase platform:**
  - **App Check** protects the AI Logic calls: a debug token in dev, reCAPTCHA Enterprise in production.
  - **Remote Config** chooses the cloud model without a redeploy.
  - **Hosting** serves the app with security headers.
- **Frontend:** React 19 + TypeScript + Vite. pdf.js is lazy-loaded for local PDF text extraction. Markdown answers are rendered into React elements, with no `innerHTML`.
- **Measured, not guessed.** We wrote 20 synthetic documents across 6 domains with hand-labelled personal data. They are scored in unit tests and live in the app, with real Gemini Nano. An end-to-end browser test drives the whole flow in real Chrome with real Nano, and intercepts the cloud call to assert that nothing labelled ever leaves the device.

## Challenges we ran into

- **Gemini Nano is good at extraction but inconsistent across runs:** it would miss a different name each time. We stopped relying on it alone. Every item type that can have a deterministic backstop got one, and Nano became the layer that catches what rules can't, such as addresses and unusual names.
  - Recall went from 97% to 99–100%.
  - Safe mode's recall went from 36% to 83%, with 100% precision.
- **Small details broke privacy in surprising ways:**
  - A regex `i` flag silently disabled the capital-letter checks inside Unicode property classes.
  - A PDF's column layout made "Daniel Okafor Patient" look like one name.
  - A hidden "Al" first matched inside "Total".
  - Each one became a regression test.
- **Nano needs a user gesture to load,** and its first call is slow. We warm it up on the first click into the document box and show progress.
- **Restoring without hallucination.** We restore with plain token replacement from a local vault, never with a model, and we warn when the cloud model invents a placeholder.

## Accomplishments that we're proud of

- **99–100% recall at 97–98% precision** on our labelled set with patterns + Nano, and **100% precision** in safe mode.
- **An airlock you can see:** the exact outgoing text, a blocking re-scan, and a trust log that shows exactly the text the network request carried. The end-to-end test checks this.
- **A hybrid design where each mode has a reason to exist,** not a demo of switching modes.
- **It works offline, works without Nano, and works on a phone-width screen.**

## What we learned

- **Hybrid AI is most compelling when the split itself delivers value.** Here the device is the trust boundary, and the cloud is the brain.
- **Small on-device models shine at narrow, constrained tasks** like JSON extraction, located verbatim. They struggle at open reasoning, which is exactly what the cloud is for.
- **Privacy features need evaluation sets and tests just like accuracy features do.** "It looked fine in the demo" hides run-to-run variance.

## What's next

- OCR for scanned PDFs, on the device.
- A Chrome extension that runs the airlock in front of any chatbot's text box.
- More languages and region-specific ID formats.
- Optional generalisation of indirect identifiers: rare conditions, small towns, exact ages.

## How it maps to the judging criteria

- **Implementation:**
  - three deliberate inference modes
  - constrained on-device JSON
  - App Check and Remote Config
  - a measured eval set
  - unit tests and a real-Chrome end-to-end test
- **Design:**
  - a three-step flow
  - side-by-side "what leaves your device"
  - click-to-reveal highlights
  - an honest safe mode
  - works at phone width, in light and dark themes
- **Impact:** patients, tenants, employees and taxpayers can get expert-level explanations without giving up their identity.
- **Originality:** the device/cloud split *is* the privacy guarantee. Personal data is redacted before the cloud and restored after, with a visible, enforceable airlock between them.
