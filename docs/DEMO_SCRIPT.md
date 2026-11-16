# Airlock demo video script (2:50)

This script is for recording the 3-minute submission video. Record at 1280×800 or larger, with captions turned on in YouTube.

## Before recording
- **Use the computer whose Chrome has Gemini Nano ready**, with the header showing "🔒 Gemini Nano ready".
- **Warm up Nano first:** run one detection before recording, so the first-load delay isn't on camera.
- **Run `npm run dev`,** or use the deployed link, with your App Check debug token registered. Make sure one real "Explain it" works.
- **Open DevTools → Network,** filter on `generateContent`, and dock it at the bottom. Clear the log.
- **Have a second browser ready without Nano,** for example Edge or a Chrome profile with the flag off, to show safe mode.
- **Use only the built-in synthetic samples.** Never real documents.

---

## 0:00–0:15 · The problem
**Screen:** the sample PDF (`public/samples/sample-medical-bill.pdf`) open in a PDF viewer.

> "This is a hospital bill. I don't understand why my insurer didn't pay, and an AI could explain it in seconds. But to ask, I'd have to upload my name, date of birth, address, patient ID and policy number."

## 0:15–0:30 · The idea
**Screen:** Airlock's home screen, showing the three-step strip.

> "Airlock is a hybrid AI app. Gemini Nano strips out my personal details on my device, Gemini in the cloud does the hard thinking on the cleaned text, and my details are put back on my device."

## 0:30–1:05 · Redact on-device
**Do:** click **or try a sample PDF**, then **Find personal details**.

> "The PDF is read locally, never uploaded. Gemini Nano, running in Chrome through Firebase AI Logic's on-device mode, finds the names, addresses and organisations, in purple. Deterministic rules with checksums catch the IDs, phone numbers and dates, in green."

**Do:** point at the right-hand column. Click the statement date "2026-11-02" to reveal it: it appears in the outgoing text and the airlock line says "1 revealed by you". Click it again to hide it.

> "On the right is exactly what will leave my device. I'm in control: I can reveal or hide anything. Before sending, an airlock check re-scans the whole prompt. If a hidden name sneaks back in, the send button locks."

## 1:05–1:40 · Reason in the cloud, restore on-device
**Do:** choose **Explain it**, then **Send through the airlock**. Show the Network tab request payload: placeholders only.

> "Only placeholders go to the cloud. Here's the actual request: [PERSON_1], [ID_2], no real data."

**Do:** the answer appears. Scroll through it, then flip **Show what the cloud actually saw** on and off.

> "Gemini explains the bill, and my real name and policy number are restored on my device. This toggle shows what the cloud model saw."

## 1:40–2:05 · Hybrid, for real
**Do:** turn Wi-Fi off. Go to **Ask something else** → **Quick summary** → **Summarise**. The badge reads "🔒 answered on-device".

> "Offline? The quick summary runs entirely on Gemini Nano with prefer-on-device mode. No network needed."

**Do:** switch to the browser without Nano and run the same sample.

> "No Nano? Airlock tells you honestly. Pattern rules still hide IDs and contacts, it warns that names and addresses may slip through, and nothing is sent until you confirm."

## 2:05–2:30 · Proof it works
**Screen:** "Under the hood" → System status and Hybrid routes, then the Detection score table. Optionally cut to the architecture diagram in the README.

> "Every call chooses its route explicitly: on-device only for detection, so raw text can never fall back to the cloud; cloud only for reasoning; prefer on-device for the summary. App Check protects the cloud calls, and Remote Config picks the model. On 20 labelled synthetic documents, patterns alone catch 83% of personal details; with Gemini Nano, 99 to 100%."

## 2:30–2:50 · Impact
**Screen:** the **Trust log** expanded, then the home screen.

> "Patients, tenants, employees: the people who most need help with confusing documents are the ones with the most to lose by sharing them. Airlock gives them the power of a large model without giving up their identity. Redact on your device. Reason in the cloud. Restore on your device."

---

## Shot checklist
- [ ] Nano-ready header pill
- [ ] PDF read locally (the note under the text box)
- [ ] Purple and green highlights, plus a reveal and hide
- [ ] The airlock line
- [ ] The Network payload with placeholders only
- [ ] The restored answer, plus the "what the cloud saw" toggle
- [ ] The offline quick summary with the on-device badge
- [ ] Safe mode in a browser without Nano
- [ ] The score table
- [ ] The trust log
