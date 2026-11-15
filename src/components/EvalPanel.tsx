import { useState } from 'react';
import { promptNanoForJson } from '../ai/nanoPrompt';
import { DATASET } from '../eval/dataset';
import { scoreAll, type Score } from '../eval/score';
import { detectPii } from '../redact/detect';
import type { Span } from '../redact/patterns';

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Scores detection on the synthetic test set, in the browser, so Nano can take part. */
export function EvalPanel({ nanoReady }: { nanoReady: boolean }) {
  const [scores, setScores] = useState<{ patterns?: Score; nano?: Score }>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  async function evaluate(useNano: boolean) {
    const t0 = performance.now();
    const results: { doc: (typeof DATASET)[number]; spans: Span[] }[] = [];
    const errors: string[] = [];
    for (const [i, doc] of DATASET.entries()) {
      setProgress(`${useNano ? 'Nano' : 'Patterns'}: ${i + 1}/${DATASET.length}`);
      const d = await detectPii(doc.text, { useNano, prompt: promptNanoForJson });
      if (d.nanoError) errors.push(`${doc.id}: ${d.nanoError}`);
      results.push({ doc, spans: d.spans });
    }
    setProgress(errors.length ? `Nano errors on ${errors.length} doc(s): ${errors[0]}` : null);
    if (useNano) setMs(Math.round(performance.now() - t0));
    setScores((s) => ({ ...s, [useNano ? 'nano' : 'patterns']: scoreAll(results) }));
  }

  const types = [...new Set([...Object.keys(scores.patterns?.byType ?? {}), ...Object.keys(scores.nano?.byType ?? {})])];
  const cell = (s: Score | undefined, type: string) => {
    const t = s?.byType[type as keyof Score['byType']];
    return t ? `${t.caught}/${t.total}` : '—';
  };

  return (
    <section className="card">
      <h2>Detection score</h2>
      <p className="muted">
        {DATASET.length} synthetic documents with every personal item labelled. Recall = share of items hidden before
        anything leaves the device.
      </p>
      <div className="toolbar">
        <button onClick={() => evaluate(false)} disabled={progress !== null && !progress.startsWith('Nano errors')}>
          Score patterns only
        </button>
        <button onClick={() => evaluate(true)} disabled={!nanoReady || (progress !== null && !progress.startsWith('Nano errors'))}>
          Score patterns + Nano
        </button>
        {progress && <span className="muted">{progress}</span>}
      </div>

      {(scores.patterns || scores.nano) && (
        <>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Patterns only</th>
                <th>Patterns + Nano</th>
              </tr>
            </thead>
            <tbody>
              <tr className="total">
                <td>Recall</td>
                <td>{scores.patterns ? pct(scores.patterns.recall) : '—'}</td>
                <td>{scores.nano ? pct(scores.nano.recall) : '—'}</td>
              </tr>
              <tr className="total">
                <td>Precision</td>
                <td>{scores.patterns ? pct(scores.patterns.precision) : '—'}</td>
                <td>{scores.nano ? pct(scores.nano.precision) : '—'}</td>
              </tr>
              {types.map((t) => (
                <tr key={t}>
                  <td>{t}</td>
                  <td>{cell(scores.patterns, t)}</td>
                  <td>{cell(scores.nano, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scores.nano && (
            <details>
              <summary>
                Nano run details{ms !== null && ` · ${(ms / 1000).toFixed(1)} s total`}
              </summary>
              <ul className="misses">
                {scores.nano.docs.map((d) => (
                  <li key={d.id}>
                    <strong>{d.id}</strong> {d.caught}/{d.total}
                    {d.missed.length > 0 && <div className="bad">Missed: {d.missed.join(' · ')}</div>}
                    {d.falsePositives.length > 0 && <div className="warn">Extra: {d.falsePositives.join(' · ')}</div>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
