import { Icon } from '../components/Icon';
import type { TrustEntry } from './logic';
import { taskById } from './tasks';

/** Every request that left this device in this session. Memory only: cleared on reload, never stored or uploaded. */
export function TrustLog({ entries }: { entries: TrustEntry[] }) {
  const totalChars = entries.reduce((n, e) => n + e.chars, 0);
  const totalRevealed = entries.reduce((n, e) => n + e.revealed, 0);
  return (
    <section className="card trust">
      <details>
        <summary>
          <strong><Icon name="log" size={15} /> Trust log</strong>{' '}
          <span className="muted">
            {entries.length === 0
              ? '· nothing has left this device yet'
              : `· ${entries.length} request(s) left this device · ${totalChars.toLocaleString()} characters · ${totalRevealed === 0 ? 'no detected personal details' : `${totalRevealed} item(s) you chose to reveal`}`}
          </span>
        </summary>
        <p className="muted">
          Every request sent to the cloud, exactly as sent. Kept only in this tab's memory: it is cleared when you reload and is never
          stored or uploaded.
        </p>
        {entries.map((e, i) => (
          <details key={i} className="entry">
            <summary>
              {e.at.toLocaleTimeString()} · {taskById(e.task).label} · cloud · {e.chars.toLocaleString()} chars · {e.tokens} placeholder(s)
              {e.revealed > 0 && ` · ${e.revealed} revealed by you`}
            </summary>
            <pre>{e.sent}</pre>
          </details>
        ))}
      </details>
    </section>
  );
}
