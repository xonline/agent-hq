// trigger-agents/src/frontend/components/PasswordModal.tsx
import { useState } from 'react';
import { login } from '../lib/auth.js';

interface Props {
  onUnlocked: () => void;
}

export function PasswordModal({ onUnlocked }: Props) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const token = await login(pw);
    setLoading(false);
    if (token !== null) {
      onUnlocked();
    } else {
      setError('Wrong password');
      setPw('');
    }
  }

  return (
    <div className="pw-overlay">
      <form className="pw-box" onSubmit={handleSubmit}>
        <div className="pw-logo">▣ JARVIS HQ</div>
        <div className="pw-sub">Enter password to continue</div>
        <input
          className="pw-input"
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="Password"
          autoFocus
        />
        {error && <div className="pw-error">{error}</div>}
        <button className="pw-btn" type="submit" disabled={loading || !pw}>
          {loading ? '…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
