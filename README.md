# Airlock

**Redact on your device. Reason in the cloud. Restore on your device.**

Airlock lets you get AI help with sensitive documents (medical reports, legal letters, tax notices) without handing over your identity. Personal data is detected and replaced with tokens **on-device** by Gemini Nano. Only the cleaned text goes to a **cloud** Gemini model for reasoning. The answer is restored with your real details **on-device**.

Built for [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/) with the Firebase AI Logic hybrid inference SDK.

> Status: early scaffold. See [PLAN.md](PLAN.md).

## How the hybrid routing works

| Step | Inference mode | Why |
|---|---|---|
| Detect personal data, airlock check | `ONLY_ON_DEVICE` | Raw text must never leave the device. The SDK throws instead of falling back to the cloud |
| Reason over the cleaned text | `ONLY_IN_CLOUD` | Needs a larger model. Only ever receives tokens |
| Quick summary | `PREFER_ON_DEVICE` | Works offline. Uses the cloud when Nano is missing |
| Restore real values | No model | Plain text replacement from a local vault, so nothing is invented |

## Setup

Requirements: Node 20+, desktop Chrome with Gemini Nano, and a Firebase project.

1. **Firebase project**
   - Create a Firebase project and enable **Firebase AI Logic** with the Gemini Developer API.
   - Register a **Web app**.
2. **App Check**
   - Register the web app with **reCAPTCHA Enterprise**.
   - For local development, use a debug token (see `.env.example`).
3. **Local config**
   - Run `cp .env.example .env.local` and fill in the values.
4. **Gemini Nano in Chrome**
   - Enable `chrome://flags/#prompt-api-for-gemini-nano` and restart Chrome. Then use **Warm up Nano** in the app to download the model.
5. **Run it**
   ```sh
   npm install
   npm run dev
   ```
   Run the tests with `npm test`.

If Nano isn't available, the app still works. On-device-only steps fall back to pattern-based redaction and ask for explicit consent before anything is sent.

## License

[Apache 2.0](LICENSE)
