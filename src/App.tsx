import { useEffect, useState } from 'react';
import { CLOUD_MODEL, firebase } from './firebase';
import { run, warmUpDeviceModel, type Route, type RunResult } from './ai/models';
import { NANO_HELP, nanoStatus, type NanoStatus } from './ai/nano';
import { EvalPanel } from './components/EvalPanel';
import { RedactionPanel } from './components/RedactionPanel';

const ROUTES: { route: Route; label: string; note: string }[] = [
  { route: 'device', label: 'On-device only', note: 'ONLY_ON_DEVICE · fails without Nano' },
  { route: 'cloud', label: 'Cloud only', note: `ONLY_IN_CLOUD · ${CLOUD_MODEL}` },
  { route: 'prefer-device', label: 'Prefer on-device', note: 'PREFER_ON_DEVICE · falls back to cloud' },
];

type Outcome = { ok: true; result: RunResult } | { ok: false; error: string };

export default function App() {
  const [nano, setNano] = useState<NanoStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('In one sentence, what is hybrid AI inference?');
  const [busy, setBusy] = useState<Route | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<Route, Outcome>>>({});

  const refreshNano = () => nanoStatus().then(setNano);
  const nanoReady = Boolean(firebase) && nano === 'available';
  useEffect(() => {
    refreshNano();
  }, []);


  async function warmUp() {
    setProgress(0);
    try {
      await warmUpDeviceModel((f) => setProgress(f));
    } catch (e) {
      alert(`Warm-up failed: ${(e as Error).message}`);
    } finally {
      setProgress(null);
      refreshNano();
    }
  }

  async function runRoute(route: Route) {
    setBusy(route);
    try {
      const result = await run(route, prompt);
      setOutcomes((o) => ({ ...o, [route]: { ok: true, result } }));
    } catch (e) {
      setOutcomes((o) => ({ ...o, [route]: { ok: false, error: (e as Error).message } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <header>
        <h1>Airlock</h1>
        <p className="tagline">Redact on your device. Reason in the cloud. Restore on your device.</p>
      </header>

      <section className="card">
        <h2>System status</h2>
        <dl className="status">
          <dt>Firebase</dt>
          <dd>{firebase ? <Ok>configured ({firebase.app.options.projectId})</Ok> : <Bad>not configured — copy .env.example to .env.local</Bad>}</dd>
          <dt>App Check</dt>
          <dd>
            {!firebase ? '—' : firebase.appCheck === 'off' ? <Bad>off — AI Logic calls will be rejected</Bad> : <Ok>{firebase.appCheck}</Ok>}
          </dd>
          <dt>Gemini Nano</dt>
          <dd>
            {nano === null ? 'checking…' : nano === 'available' ? <Ok>{NANO_HELP[nano]}</Ok> : <Warn>{NANO_HELP[nano]}</Warn>}
          </dd>
        </dl>
        {firebase && (nano === 'downloadable' || nano === 'downloading') && (
          <button onClick={warmUp} disabled={progress !== null}>
            {progress === null ? 'Warm up Nano' : `Downloading… ${Math.round(progress * 100)}%`}
          </button>
        )}
      </section>

      <section className="card">
        <h2>Hybrid lab</h2>
        <p className="muted">Send the same prompt down each route. The badge shows where the SDK says it actually ran.</p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
        <div className="routes">
          {ROUTES.map(({ route, label, note }) => {
            const o = outcomes[route];
            return (
              <div key={route} className="route">
                <button onClick={() => runRoute(route)} disabled={!firebase || busy !== null || !prompt.trim()}>
                  {busy === route ? 'Running…' : label}
                </button>
                <small className="muted">{note}</small>
                {o?.ok && (
                  <div className="result">
                    <span className={`badge ${o.result.where}`}>
                      {o.result.where === 'on_device' ? '🔒 on-device' : '☁️ cloud'} · {o.result.ms} ms
                    </span>
                    <p>{o.result.text}</p>
                  </div>
                )}
                {o && !o.ok && <p className="error">{o.error}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <RedactionPanel nanoReady={nanoReady} />
      <EvalPanel nanoReady={nanoReady} />
    </main>
  );
}

const Ok = ({ children }: { children: React.ReactNode }) => <span className="ok">{children}</span>;
const Warn = ({ children }: { children: React.ReactNode }) => <span className="warn">{children}</span>;
const Bad = ({ children }: { children: React.ReactNode }) => <span className="bad">{children}</span>;
