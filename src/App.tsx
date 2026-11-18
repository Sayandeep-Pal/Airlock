import { useState } from 'react';
import { Icon, Logo } from './components/Icon';
import { Lab } from './components/Lab';
import { AirlockFlow } from './flow/AirlockFlow';
import { useNano } from './flow/useNano';

type Tab = 'airlock' | 'lab';

export default function App() {
  const nano = useNano();
  const [tab, setTab] = useState<Tab>('airlock');
  const state = nano.status === null ? 'checking' : nano.ready ? 'ready' : 'safe';

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Airlock home">
            <Logo />
            <span>Airlock</span>
          </a>
          <nav className="tabs" role="tablist" aria-label="Sections">
            <button role="tab" aria-selected={tab === 'airlock'} className={tab === 'airlock' ? 'active' : ''} onClick={() => setTab('airlock')}>
              Airlock
            </button>
            <button role="tab" aria-selected={tab === 'lab'} className={tab === 'lab' ? 'active' : ''} onClick={() => setTab('lab')}>
              Under the hood
            </button>
          </nav>
          <span className={`pill ${state}`} title="Gemini Nano status">
            <span className="dot" aria-hidden="true" />
            {state === 'checking' ? 'Checking Nano…' : state === 'ready' ? 'Gemini Nano ready' : 'Safe mode (no Nano)'}
          </span>
        </div>
      </header>

      <main>
        {/* Both stay mounted so switching tabs never loses the document, answer or trust log. */}
        <div hidden={tab !== 'airlock'}>
          <AirlockFlow nano={nano} />
        </div>
        <div hidden={tab !== 'lab'}>
          <Lab nano={nano} />
        </div>

        <footer className="app-footer">
          <span>
            <Icon name="lock" size={13} /> No account, no storage. Your document and its placeholders live only in this tab.
          </span>
          <span>
            Firebase AI Logic hybrid inference ·{' '}
            <a href="https://github.com/Sayandeep-Pal/Airlock" target="_blank" rel="noreferrer">
              Source
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
