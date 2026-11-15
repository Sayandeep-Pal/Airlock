import { useMemo, useState } from 'react';
import { promptNanoForJson } from '../ai/nanoPrompt';
import { detectPii, type Detection } from '../redact/detect';
import { detectPatterns } from '../redact/patterns';
import { findLeaks, redact } from '../redact/vault';
import { DATASET } from '../eval/dataset';
import { Highlighted } from './Highlighted';

export function RedactionPanel({ nanoReady }: { nanoReady: boolean }) {
  const [doc, setDoc] = useState(DATASET[0].text);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [busy, setBusy] = useState(false);

  // Patterns run live as you type; Nano runs on demand.
  const spans = useMemo(() => detection?.spans ?? detectPatterns(doc), [detection, doc]);
  const preview = useMemo(() => {
    const { redacted, vault } = redact(doc, spans);
    return { redacted, leaks: findLeaks(redacted, vault) };
  }, [doc, spans]);

  async function runNano() {
    setBusy(true);
    try {
      setDetection(await detectPii(doc, { useNano: true, prompt: promptNanoForJson }));
    } finally {
      setBusy(false);
    }
  }

  const loadSample = (text: string) => {
    setDoc(text);
    setDetection(null);
  };

  return (
    <section className="card">
      <h2>
        Redaction <span className="badge on_device">🔒 on-device</span>
      </h2>
      <p className="muted">
        Synthetic data only. <mark className="pii pattern">Patterns</mark> run as you type;{' '}
        <mark className="pii nano">Gemini Nano</mark> finds names, addresses, organisations and IDs.
      </p>

      <div className="toolbar">
        <select onChange={(e) => loadSample(DATASET[Number(e.target.value)].text)} aria-label="Sample document">
          {DATASET.map((d, i) => (
            <option key={d.id} value={i}>
              Sample: {d.id}
            </option>
          ))}
        </select>
        <button onClick={runNano} disabled={!nanoReady || busy || !doc.trim()}>
          {busy ? 'Nano is reading…' : 'Detect with Nano'}
        </button>
        {detection && (
          <span className="muted">
            {detection.usedNano ? `Nano + patterns · ${detection.ms} ms` : <span className="bad">Nano failed: {detection.nanoError}</span>}
          </span>
        )}
      </div>

      <textarea
        value={doc}
        onChange={(e) => {
          setDoc(e.target.value);
          setDetection(null);
        }}
        rows={8}
        aria-label="Original document"
      />
      <div className="split">
        <div>
          <h3>Found on your device</h3>
          <Highlighted text={doc} spans={spans} />
        </div>
        <div>
          <h3>What would leave the device</h3>
          <pre>{preview.redacted}</pre>
        </div>
      </div>
      <p className="muted">
        {spans.length} item(s) redacted. Airlock re-scan:{' '}
        {preview.leaks.length === 0 ? <span className="ok">clear</span> : <span className="bad">{preview.leaks.length} leak(s)</span>}
      </p>
    </section>
  );
}
