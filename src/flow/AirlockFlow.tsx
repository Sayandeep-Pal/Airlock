import { useMemo, useState } from 'react';
import { run, type Where } from '../ai/models';
import { promptNanoForJson } from '../ai/nanoPrompt';
import { Highlighted } from '../components/Highlighted';
import { Markdown } from '../components/Markdown';
import { DATASET } from '../eval/dataset';
import { firebase } from '../firebase';
import { detectPii, type Detection } from '../redact/detect';
import { mergeSpans } from '../redact/merge';
import type { Span } from '../redact/patterns';
import { redact, restore } from '../redact/vault';
import { activeSpans, findPhrase, outgoingLeaks, spanKey, tokensIn, unknownTokens, type TrustEntry } from './logic';
import { buildTaskPrompt, taskById, TASKS, type TaskId } from './tasks';
import { TrustLog } from './TrustLog';
import type { NanoState } from './useNano';

type Stage = 'input' | 'review' | 'answer';

const SAMPLES: { id: string; title: string }[] = [
  { id: 'med-01', title: 'Hospital discharge summary' },
  { id: 'legal-03', title: 'Loan default legal notice' },
  { id: 'tax-02', title: 'Tax office notice' },
  { id: 'hr-01', title: 'HR complaint' },
  { id: 'housing-01', title: 'Notice to vacate' },
  { id: 'ins-01', title: 'Insurance claim rejection' },
];

interface Answer {
  task: TaskId;
  text: string;
  where: Where;
  ms: number;
}

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'input', label: 'Document' },
  { stage: 'review', label: 'Review & send' },
  { stage: 'answer', label: 'Answer' },
];

export function AirlockFlow({ nano }: { nano: NanoState }) {
  const [stage, setStage] = useState<Stage>('input');
  const [doc, setDoc] = useState('');
  const [detection, setDetection] = useState<Detection | null>(null);
  const [manual, setManual] = useState<Span[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [phrase, setPhrase] = useState('');
  const [taskId, setTaskId] = useState<TaskId>('explain');
  const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [showTokens, setShowTokens] = useState(false);
  const [busy, setBusy] = useState<'detect' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<TrustEntry[]>([]);

  // ---- Derived state: everything below is computed on the device. ----
  const allSpans = useMemo(() => (detection ? mergeSpans(doc, [...detection.spans, ...manual]) : []), [doc, detection, manual]);
  const spans = useMemo(() => (detection ? activeSpans(doc, detection.spans, manual, revealed) : []), [doc, detection, manual, revealed]);
  const revealedValues = useMemo(() => allSpans.filter((s) => revealed.has(spanKey(s))).map((s) => s.value), [allSpans, revealed]);
  const { redacted, vault } = useMemo(() => redact(doc, spans), [doc, spans]);
  const task = taskById(taskId);
  const prompt = useMemo(() => buildTaskPrompt(task, redacted), [task, redacted]);
  // The airlock check runs on the full prompt, i.e. exactly what would be sent.
  const leaks = useMemo(() => outgoingLeaks(prompt, vault, revealedValues), [prompt, vault, revealedValues]);
  const safeMode = detection !== null && !detection.usedNano;
  const canSend = Boolean(firebase) && leaks.length === 0 && (!safeMode || consent) && busy === null;

  const counts = useMemo(() => {
    const by = { nano: 0, pattern: 0, manual: 0 };
    for (const s of spans) by[s.source]++;
    return by;
  }, [spans]);

  function reset(nextDoc = '') {
    setDoc(nextDoc);
    setDetection(null);
    setManual([]);
    setRevealed(new Set());
    setPhrase('');
    setConsent(false);
    setAnswer(null);
    setError(null);
    setStage('input');
  }

  async function detect() {
    setBusy('detect');
    setError(null);
    try {
      const d = await detectPii(doc, { useNano: nano.ready, prompt: promptNanoForJson });
      setDetection(d);
      setManual([]);
      setRevealed(new Set());
      setConsent(false);
      setStage('review');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function toggle(s: Span) {
    setRevealed((prev) => {
      const next = new Set(prev);
      const k = spanKey(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function hidePhrase() {
    const found = findPhrase(doc, phrase);
    if (found.length === 0) {
      setError(`"${phrase.trim()}" doesn't appear in the document.`);
      return;
    }
    setError(null);
    setManual((m) => [...m, ...found]);
    setPhrase('');
  }

  async function send() {
    if (!canSend) return;
    setBusy('send');
    setError(null);
    try {
      const result = await run(task.route, prompt);
      if (result.where === 'in_cloud') {
        setLog((l) => [
          { at: new Date(), task: task.id, where: result.where, chars: prompt.length, tokens: tokensIn(redacted).length, revealed: revealedValues.length, sent: prompt },
          ...l,
        ]);
      }
      setAnswer({ task: task.id, text: result.text, where: result.where, ms: result.ms });
      setShowTokens(false);
      setStage('answer');
    } catch (e) {
      const msg = (e as Error).message;
      setError(navigator.onLine ? msg : `You're offline, so the cloud can't be reached. "Quick summary" works offline on devices with Gemini Nano. (${msg})`);
    } finally {
      setBusy(null);
    }
  }

  const stageIndex = STEPS.findIndex((s) => s.stage === stage);
  const invented = answer ? unknownTokens(answer.text, vault) : [];

  return (
    <>
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.stage} className={i < stageIndex ? 'done' : i === stageIndex ? 'current' : ''} aria-current={i === stageIndex ? 'step' : undefined}>
            <span className="dot">{i < stageIndex ? '✓' : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {/* ---------------- 1. Document ---------------- */}
      {stage === 'input' && (
        <section className="card">
          <h2>Paste a document you'd rather not share</h2>
          <p className="muted">
            A medical report, a legal notice, a tax letter… Airlock finds the personal details <strong>on your device</strong> before
            anything goes to the cloud. Use made-up data while testing.
          </p>
          <div className="toolbar">
            <select value="" onChange={(e) => e.target.value && reset(DATASET.find((d) => d.id === e.target.value)!.text)} aria-label="Try a sample">
              <option value="">Try a sample…</option>
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            // A click or key press counts as a user gesture, which Chrome requires to load Nano.
            onPointerDown={() => nano.ready && !nano.warm && nano.warmUp()}
            onKeyDown={() => nano.ready && !nano.warm && nano.warmUp()}
            rows={12}
            placeholder="Paste your document here…"
            aria-label="Your document"
          />
          <NanoNotice nano={nano} />
          <div className="actions">
            <button className="primary" onClick={detect} disabled={!doc.trim() || busy !== null}>
              {busy === 'detect' ? (nano.ready ? 'Gemini Nano is reading on your device…' : 'Scanning…') : 'Find personal details 🔒'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {/* ---------------- 2. Review & send ---------------- */}
      {stage === 'review' && detection && (
        <section className="card">
          <h2>
            Review what stays private <span className="badge on_device">🔒 on-device · {detection.ms} ms</span>
          </h2>

          {safeMode ? (
            <div className="banner warn-banner" role="alert">
              <strong>Safe mode: Gemini Nano isn't available{detection.nanoError ? ` (${detection.nanoError})` : ''}.</strong> Only pattern rules ran, so
              emails, phone numbers, card and ID numbers are hidden, but <strong>names, addresses and organisations may not be</strong>. Mark them
              yourself below before sending.
            </div>
          ) : (
            <p className="muted">
              Gemini Nano found {counts.nano}, pattern rules found {counts.pattern}
              {counts.manual > 0 && `, you marked ${counts.manual}`}. Click any highlighted item to reveal or hide it.
            </p>
          )}

          <div className="split">
            <div>
              <h3>Your document</h3>
              <Highlighted text={doc} spans={allSpans} revealed={revealed} onToggle={toggle} />
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  hidePhrase();
                }}
              >
                <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Hide something else, e.g. a name" aria-label="Phrase to hide" />
                <button type="submit" className="secondary" disabled={phrase.trim().length < 2}>
                  Hide
                </button>
              </form>
            </div>
            <div>
              <h3>What will leave your device</h3>
              <pre className="outgoing">{redacted}</pre>
              <p className={leaks.length ? 'airlock blocked' : 'airlock clear'} role="status">
                {leaks.length === 0 ? (
                  <>
                    ✅ Airlock check passed · {spans.length} item(s) hidden · {redacted.length} characters
                    {revealedValues.length > 0 && ` · ${revealedValues.length} revealed by you`}
                  </>
                ) : (
                  <>⛔ Airlock blocked: {leaks.map((l) => `${l.type} "${l.value}"`).join(', ')} would leak.</>
                )}
              </p>
            </div>
          </div>

          <h3>What do you need?</h3>
          <div className="tasks" role="radiogroup" aria-label="Task">
            {TASKS.map((t) => (
              <label key={t.id} className={`task${taskId === t.id ? ' selected' : ''}`}>
                <input type="radio" name="task" value={t.id} checked={taskId === t.id} onChange={() => setTaskId(t.id)} />
                <strong>{t.label}</strong>
                <span className="muted">{t.hint}</span>
                <span className={`badge ${t.route === 'cloud' ? 'in_cloud' : 'on_device'}`}>
                  {t.route === 'cloud' ? '☁️ cloud' : nano.ready ? '🔒 on-device' : '☁️ cloud (no Nano)'}
                </span>
              </label>
            ))}
          </div>

          {safeMode && (
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I checked the text on the right and I'm OK
              sending it.
            </label>
          )}

          <div className="actions">
            <button className="secondary" onClick={() => setStage('input')} disabled={busy !== null}>
              ← Edit document
            </button>
            <button className="primary" onClick={send} disabled={!canSend}>
              {busy === 'send' ? 'Working…' : task.route === 'cloud' ? 'Send through the airlock ☁️' : 'Summarise 🔒'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {/* ---------------- 3. Answer ---------------- */}
      {stage === 'answer' && answer && (
        <section className="card">
          <h2>
            {taskById(answer.task).label}{' '}
            <span className={`badge ${answer.where}`}>
              {answer.where === 'on_device' ? '🔒 answered on-device' : '☁️ answered in the cloud'} · {(answer.ms / 1000).toFixed(1)} s
            </span>
          </h2>
          <p className="muted">
            {answer.where === 'in_cloud' ? 'The cloud only saw placeholders. ' : 'Nothing left your device. '}
            Your real details were put back <strong>on your device</strong>.
          </p>
          <div className="toolbar">
            <label className="switch">
              <input type="checkbox" checked={showTokens} onChange={(e) => setShowTokens(e.target.checked)} />
              Show what the {answer.where === 'in_cloud' ? 'cloud' : 'model'} actually saw
            </label>
          </div>
          <div className="answer">
            <Markdown text={showTokens ? answer.text : restore(answer.text, vault)} />
          </div>
          {invented.length > 0 && (
            <p className="warn">The model used placeholder(s) that don't exist in your document: {invented.join(', ')}. They were left as-is.</p>
          )}
          <div className="actions">
            <button className="secondary" onClick={() => setStage('review')}>
              ← Ask something else
            </button>
            <button className="secondary" onClick={() => reset()}>
              New document
            </button>
          </div>
        </section>
      )}

      <TrustLog entries={log} />
    </>
  );
}

function NanoNotice({ nano }: { nano: NanoState }) {
  if (!firebase) return <p className="bad">Firebase isn't configured. See the README.</p>;
  if (nano.status === null) return null;
  if (nano.ready)
    return (
      <p className="muted">
        🔒 Gemini Nano is ready on this device{nano.progress !== null ? ` · loading ${Math.round(nano.progress * 100)}%` : nano.warm ? ' and warmed up' : ''}.
      </p>
    );
  if (nano.status === 'downloadable' || nano.status === 'downloading')
    return (
      <p className="warn">
        Gemini Nano isn't downloaded yet.{' '}
        <button className="link" onClick={nano.warmUp} disabled={nano.progress !== null}>
          {nano.progress === null ? 'Download it now (one-time)' : `Downloading… ${Math.round(nano.progress * 100)}%`}
        </button>{' '}
        Or continue in safe mode.
      </p>
    );
  return (
    <p className="warn">
      Gemini Nano isn't available in this browser, so Airlock will run in <strong>safe mode</strong> (pattern rules only, you review before
      sending).
    </p>
  );
}
