// trigger-agents/src/frontend/components/SettingsView.tsx
import { useState, useEffect } from 'react';
import type { SystemStats } from '../types/hq.js';
import { setPassword, clearPassword, authHeaders } from '../lib/auth.js';

interface Props {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  fontStep: number;
  onFontInc: () => void;
  onFontDec: () => void;
  onFontReset: () => void;
  onClearFeed: () => void;
  feedCount: number;
  stats: SystemStats | null;
  isProtected: boolean;
  onPasswordUpdate: (nowProtected: boolean) => void;
}

export function SettingsView({ theme, onThemeToggle, fontStep, onFontInc, onFontDec, onFontReset, onClearFeed, feedCount, stats, isProtected, onPasswordUpdate }: Props) {
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [maxDone, setMaxDone] = useState(10);
  const [pruneDays, setPruneDays] = useState(0);

  // Load Kanban settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('kanban-max-done');
    if (stored) setMaxDone(parseInt(stored));
    const storedPrune = localStorage.getItem('kanban-prune-days');
    if (storedPrune) setPruneDays(parseInt(storedPrune));
  }, []);

  function handleMaxDoneChange(val: number) {
    const clamped = Math.max(1, Math.min(50, val));
    setMaxDone(clamped);
    localStorage.setItem('kanban-max-done', String(clamped));
  }

  function handlePruneDaysChange(val: number) {
    const clamped = Math.max(0, Math.min(365, val));
    setPruneDays(clamped);
    localStorage.setItem('kanban-prune-days', String(clamped));
  }

  async function handleSetPassword() {
    if (!newPw || newPw.length < 4) { setPwMsg('Minimum 4 characters'); return; }
    setPwBusy(true);
    const token = await setPassword(newPw);
    setPwBusy(false);
    if (token) {
      setPwMsg('Password set');
      setNewPw('');
      onPasswordUpdate(true);
    } else {
      setPwMsg('Failed to set password');
    }
  }

  async function handleClearPassword() {
    setPwBusy(true);
    const ok = await clearPassword();
    setPwBusy(false);
    if (ok) {
      setPwMsg('Password removed');
      onPasswordUpdate(false);
    } else {
      setPwMsg('Failed');
    }
  }

  // Validate current token is still working
  async function handleVerify() {
    const r = await fetch('/api/stats', { headers: authHeaders() });
    setPwMsg(r.ok ? 'Token valid' : 'Token invalid — reload to re-login');
  }

  return (
    <div className="view-settings">
      <div className="settings-section">
        <div className="settings-hdr">// appearance</div>
        <div className="settings-row">
          <span className="settings-label">Theme</span>
          <div className="settings-controls">
            <button
              className={`ctrl-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => theme !== 'dark' && onThemeToggle()}
            >
              🌙 Night
            </button>
            <button
              className={`ctrl-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => theme !== 'light' && onThemeToggle()}
            >
              ☀ Day
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">Font size</span>
          <div className="settings-controls">
            <button className="ctrl-btn" onClick={onFontDec} disabled={fontStep <= -7}>A−</button>
            <button className={`ctrl-btn${fontStep === 0 ? ' active' : ''}`} onClick={onFontReset} title="Reset to default">A</button>
            <button className="ctrl-btn" onClick={onFontInc} disabled={fontStep >= 10}>A+</button>
            <span className="settings-value c-dim" style={{ marginLeft: 6 }}>
              {fontStep === 0 ? 'default' : fontStep > 0 ? `+${fontStep}` : `${fontStep}`}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-hdr">// access</div>
        <div className="settings-row">
          <span className="settings-label">Status</span>
          <span className={`settings-value ${isProtected ? 'c-green' : 'c-amber'}`}>
            {isProtected ? '🔒 Password protected' : '🔓 Open access'}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-label">{isProtected ? 'Change password' : 'Set password'}</span>
          <div className="settings-controls">
            <input
              className="pw-field"
              type="password"
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setPwMsg(''); }}
              placeholder="New password"
            />
            <button className="ctrl-btn" onClick={handleSetPassword} disabled={pwBusy || !newPw}>
              {isProtected ? 'Change' : 'Enable'}
            </button>
          </div>
        </div>
        {isProtected && (
          <div className="settings-row">
            <span className="settings-label">Remove lock</span>
            <div className="settings-controls">
              <button className="ctrl-btn c-red" onClick={handleClearPassword} disabled={pwBusy}>
                Remove password
              </button>
              <button className="ctrl-btn" onClick={handleVerify}>Check token</button>
            </div>
          </div>
        )}
        {pwMsg && <div className="settings-row"><span className="settings-label" /><span className="settings-value c-dim">{pwMsg}</span></div>}
      </div>

      <div className="settings-section">
        <div className="settings-hdr">// live feed</div>
        <div className="settings-row">
          <span className="settings-label">Feed entries</span>
          <span className="settings-value c-text">{feedCount} / 50</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Clear feed</span>
          <button className="ctrl-btn" onClick={onClearFeed} disabled={feedCount === 0}>
            Clear ({feedCount})
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-hdr">// kanban</div>
        <div className="settings-row">
          <span className="settings-label">Max done items</span>
          <div className="settings-controls">
            <input
              type="number"
              min="1"
              max="50"
              value={maxDone}
              onChange={e => handleMaxDoneChange(parseInt(e.target.value) || 10)}
              style={{ width: '50px', padding: '3px 6px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: '2px', fontFamily: 'var(--font)' }}
            />
            <span className="settings-value c-dim">per category</span>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">Auto-prune after</span>
          <div className="settings-controls">
            <input
              type="number"
              min="0"
              max="365"
              value={pruneDays}
              onChange={e => handlePruneDaysChange(parseInt(e.target.value) || 0)}
              style={{ width: '50px', padding: '3px 6px', border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', borderRadius: '2px', fontFamily: 'var(--font)' }}
            />
            <span className="settings-value c-dim">{pruneDays === 0 ? 'disabled' : `${pruneDays} days`}</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-hdr">// system</div>
        <div className="settings-row">
          <span className="settings-label">CPU Load</span>
          <span className="settings-value c-amber">{stats ? `${stats.cpu}` : '—'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">RAM</span>
          <span className="settings-value c-text">
            {stats ? `${(stats.mem / 1024).toFixed(1)} / ${(stats.memTotal / 1024).toFixed(1)} GB` : '—'}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Disk</span>
          <span className="settings-value c-text">
            {stats ? `${(stats.diskUsed / 1024).toFixed(1)} / ${(stats.diskTotal / 1024).toFixed(1)} GB` : '—'}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Jobs active</span>
          <span className="settings-value c-blue">{stats?.bullActive ?? '—'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Jobs waiting</span>
          <span className="settings-value c-amber">{stats?.bullWaiting ?? '—'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Tokens today</span>
          <span className="settings-value c-cyan">
            {stats
              ? stats.tokensToday >= 1_000_000
                ? `${(stats.tokensToday / 1_000_000).toFixed(2)}M`
                : stats.tokensToday >= 1000
                ? `${(stats.tokensToday / 1000).toFixed(0)}k`
                : String(stats.tokensToday)
              : '—'}
          </span>
        </div>
        <div className="settings-row">
          <span className="settings-label">Est. API cost</span>
          <span className="settings-value c-purple">{stats ? `$${stats.costToday.toFixed(4)}` : '—'}</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-hdr">// about</div>
        <div className="settings-row">
          <span className="settings-label">Version</span>
          <span className="settings-value c-dim">trigger-agents v3</span>
        </div>
        <div className="settings-row">
          <span className="settings-label">SSE endpoint</span>
          <span className="settings-value c-dim">/api/events/hq</span>
        </div>
      </div>
    </div>
  );
}
