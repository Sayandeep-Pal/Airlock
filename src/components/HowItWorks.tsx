import type { NanoState } from '../flow/useNano';
import { Icon } from './Icon';

/** The three-step promise, shown on the first screen. */
export function HowItWorks() {
  return (
    <ol className="how" aria-label="How Airlock works">
      <li>
        <span className="how-n">01</span>
        <strong>
          <Icon name="device" size={15} /> Redact on your device
        </strong>
        <span>Gemini Nano and pattern rules swap names, IDs and addresses for placeholders.</span>
      </li>
      <li>
        <span className="how-n">02</span>
        <strong>
          <Icon name="cloud" size={15} /> Reason in the cloud
        </strong>
        <span>Gemini sees only the cleaned text, after an airlock check you can read.</span>
      </li>
      <li>
        <span className="how-n">03</span>
        <strong>
          <Icon name="device" size={15} /> Restore on your device
        </strong>
        <span>Your real details go back into the answer locally. Nothing is stored.</span>
      </li>
    </ol>
  );
}

/** Instructions for judges and first-time visitors, adapted to what this browser supports. */
export function TryItBox({ nano }: { nano: NanoState }) {
  return (
    <details className="try" open={nano.status !== null && !nano.ready}>
      <summary>How to try it {nano.ready ? '· Gemini Nano is ready here' : '· no Gemini Nano in this browser yet'}</summary>
      <ol>
        <li>
          Pick a sample from <strong>Try a sample…</strong>, or open a PDF. All samples are made up.
        </li>
        <li>
          Press <strong>Find personal details</strong>. Solid marks come from Gemini Nano, grey ones from pattern rules. Click any mark
          to reveal or hide it.
        </li>
        <li>
          Check <strong>What will leave your device</strong>, choose a task and send. The answer comes back with your real details put
          back in.
        </li>
        <li>
          Open the <strong>Trust log</strong> at the bottom to see exactly what the cloud received.
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
