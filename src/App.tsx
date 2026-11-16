import { useState } from 'react';
import { Lab } from './components/Lab';
import { AirlockFlow } from './flow/AirlockFlow';
import { useNano } from './flow/useNano';

type Tab = 'airlock' | 'lab';

export default function App() {
  const nano = useNano();
  const [tab, setTab] = useState<Tab>('airlock');

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>
            <img src="/favicon.svg" alt="" width="32" height="32" className="logo" />
            Airlock
          </h1>
          <p className="tagline">Redact on your device. Reason in the cloud. Restore on your device.</p>
        </div>
        <span className={`pill ${nano.ready ? 'on_device' : 'warn'}`} title="Gemini Nano status">
          {nano.status === null ? 'Checking Nano…' : nano.ready ? '🔒 Gemini Nano ready' : '⚠ Safe mode (no Nano)'}
        </span>
      </header>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'airlock'} className={tab === 'airlock' ? 'active' : ''} onClick={() => setTab('airlock')}>
          Airlock
        </button>
        <button role="tab" aria-selected={tab === 'lab'} className={tab === 'lab' ? 'active' : ''} onClick={() => setTab('lab')}>
          Under the hood
        </button>
      </nav>

      {/* Both stay mounted so switching tabs never loses the document, answer or trust log. */}
      <div hidden={tab !== 'airlock'}>
        <AirlockFlow nano={nano} />
      </div>
      <div hidden={tab !== 'lab'}>
        <Lab nano={nano} />
      </div>

      <footer className="app-footer">
        <span>No account, no storage: your document and its placeholders live only in this tab.</span>
        <span>
          Built with Firebase AI Logic hybrid inference ·{' '}
          <a href="https://github.com/Sayandeep-Pal/Airlock" target="_blank" rel="noreferrer">
            Source
          </a>
        </span>
      </footer>
    </main>
  );
}
