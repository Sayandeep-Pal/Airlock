import type { NanoState } from '../flow/useNano';

/** The three-step promise, shown on the first screen. */
export function HowItWorks() {
  return (
    <ol className="how" aria-label="How Airlock works">
      <li className="on_device">
        <span className="how-icon" aria-hidden="true">
          🔒
        </span>
        <strong>Redact on your device</strong>
        <span>Gemini Nano and pattern rules swap names, IDs and addresses for placeholders.</span>
      </li>
      <li className="in_cloud">
        <span className="how-icon" aria-hidden="true">
          ☁️
        </span>
        <strong>Reason in the cloud</strong>
        <span>Gemini sees only the cleaned text, after an airlock check you can read.</span>
      </li>
      <li className="on_device">
        <span className="how-icon" aria-hidden="true">
          🔒
        </span>
        <strong>Restore on your device</strong>
        <span>Your real details go back into the answer locally. Nothing is stored.</span>
      </li>
    </ol>
  );
}

/** Instructions for judges and first-time visitors, adapted to what this browser supports. */
export function TryItBox({ nano }: { nano: NanoState }) {
  return (
    <details className="try" open={nano.status !== null && !nano.ready}>
      <summary>How to try it {nano.ready ? '(Gemini Nano is ready here)' : '(no Gemini Nano in this browser yet)'}</summary>
      <ol>
        <li>
          Pick a sample from <strong>Try a sample…</strong>, or open a PDF. All samples are made up.
        </li>
        <li>
          Press <strong>Find personal details</strong>. Purple highlights come from Gemini Nano, green ones from pattern rules. Click
          any highlight to reveal or hide it.
        </li>
        <li>
          Check <strong>What will leave your device</strong>, choose a task and send. The answer comes back with your real details put
          back in.
        </li>
        <li>
          Open <strong>Requests that left this device</strong> at the bottom to see exactly what the cloud received.
        </li>
      </ol>
      <p className="muted">
        <strong>To get the full hybrid experience</strong> use desktop Chrome: open <code>chrome://flags/#prompt-api-for-gemini-nano</code>
        , set it to <em>Enabled</em>, restart Chrome, then come back and click into the document box to download Gemini Nano (one time,
        a few GB). <strong>Without Nano</strong> Airlock runs in safe mode: pattern rules still hide emails, phone numbers, IDs, names
        after titles and company names, and you confirm before anything is sent.
      </p>
    </details>
  );
}
