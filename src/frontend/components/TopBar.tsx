// trigger-agents/src/frontend/components/TopBar.tsx

interface Props {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  fontStep: number;
  onFontInc: () => void;
  onFontDec: () => void;
  onFontReset: () => void;
}

export function TopBar({ theme, onThemeToggle, fontStep, onFontInc, onFontDec, onFontReset }: Props) {
  return (
    <header className="topbar">
      <div className="logo">
        <div className="logo-dot" />
        ▣ JARVIS HQ
      </div>

      <div className="controls">
        <button
          className={`ctrl-btn${theme === 'light' ? ' active' : ''}`}
          onClick={() => theme !== 'light' && onThemeToggle()}
        >
          ☀ Day
        </button>
        <button
          className={`ctrl-btn${theme === 'dark' ? ' active' : ''}`}
          onClick={() => theme !== 'dark' && onThemeToggle()}
        >
          🌙 Night
        </button>
        <div className="ctrl-sep" />
        <button className="ctrl-btn" onClick={onFontDec} disabled={fontStep <= -7}>A−</button>
        <button className={`ctrl-btn${fontStep === 0 ? ' active' : ''}`} onClick={onFontReset} title="Reset font size">A</button>
        <button className="ctrl-btn" onClick={onFontInc} disabled={fontStep >= 10}>A+</button>
      </div>
    </header>
  );
}
