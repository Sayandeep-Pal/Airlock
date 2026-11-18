import { useEffect, useState } from 'react';
import { run, type Route, type RunResult } from '../ai/models';
import { NANO_HELP } from '../ai/nano';
import { cloudModel, cloudModelFrom, configReady, firebase } from '../firebase';
import type { NanoState } from '../flow/useNano';
import { EvalPanel } from './EvalPanel';
import { WhereBadge } from './Icon';
import { RedactionPanel } from './RedactionPanel';

const ROUTES: { route: Route; label: string; note: string }[] = [
  { route: 'device', label: 'On-device only', note: 'ONLY_ON_DEVICE · fails without Nano' },
  { route: 'cloud', label: 'Cloud only', note: 'ONLY_IN_CLOUD' },
  { route: 'prefer-device', label: 'Prefer on-device', note: 'PREFER_ON_DEVICE · falls back to cloud' },
];

type Outcome = { ok: true; result: RunResult } | { ok: false; error: string };

/** "Under the hood": system status, the three inference routes side by side, raw redaction and the detection score. */
export function Lab({ nano }: { nano: NanoState }) {
  const [prompt, setPrompt] = useState('In one sentence, what is hybrid AI inference?');
  const [busy, setBusy] = useState<Route | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<Route, Outcome>>>({});
  const [model, setModel] = useState({ name: cloudModel(), from: cloudModelFrom() });
  useEffect(() => {
    configReady.then(() => setModel({ name: cloudModel(), from: cloudModelFrom() }));
  }, []);

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
    <>
      <section className="card">
        <h2>System status</h2>
        <dl className="status">
          <dt>Firebase</dt>
          <dd>
            {firebase ? <span className="ok">configured ({firebase.app.options.projectId})</span> : <span className="bad">not configured: copy .env.example to .env.local</span>}
          </dd>
          <dt>App Check</dt>
          <dd>
            {!firebase ? '—' : firebase.appCheck === 'off' ? <span className="bad">off: AI Logic calls will be rejected</span> : <span className="ok">{firebase.appCheck}</span>}
          </dd>
          <dt>Gemini Nano</dt>
          <dd>
            {nano.status === null ? 'checking…' : <span className={nano.ready ? 'ok' : 'warn'}>{NANO_HELP[nano.status]}</span>}
            {nano.warm && <span className="muted"> · warmed up</span>}
          </dd>
          <dt>Cloud model</dt>
          <dd>
            {model.name} <span className="muted">({model.from === 'remote-config' ? 'from Remote Config' : 'default; set `cloud_model` in Remote Config to change'})</span>
          </dd>
        </dl>
        {firebase && (nano.status === 'downloadable' || nano.status === 'downloading') && (
          <button onClick={nano.warmUp} disabled={nano.progress !== null}>
            {nano.progress === null ? 'Warm up Nano' : `Downloading… ${Math.round(nano.progress * 100)}%`}
          </button>
        )}
        {nano.error && <p className="error">Warm-up failed: {nano.error}</p>}
      </section>

      <section className="card">
        <h2>Hybrid routes</h2>
        <p className="muted">Send the same prompt down each route. The badge shows where the SDK says it actually ran.</p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} />
        <div className="routes">
          {ROUTES.map(({ route, label, note }) => {
            const o = outcomes[route];
            return (
              <div key={route} className="route">
                <button className="secondary" onClick={() => runRoute(route)} disabled={!firebase || busy !== null || !prompt.trim()}>
                  {busy === route ? 'Running…' : label}
                </button>
                <small className="muted">{note}{route === 'cloud' && ` · ${model.name}`}</small>
                {o?.ok && (
                  <div className="result">
                    <WhereBadge where={o.result.where}>
                      {o.result.where === 'on_device' ? 'on-device' : 'cloud'} · {o.result.ms} ms
                    </WhereBadge>
                    <p>{o.result.text}</p>
                  </div>
                )}
                {o && !o.ok && <p className="error">{o.error}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <RedactionPanel nanoReady={nano.ready} />
      <EvalPanel nanoReady={nano.ready} />
    </>
  );
}
