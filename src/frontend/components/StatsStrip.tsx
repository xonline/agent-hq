// trigger-agents/src/frontend/components/StatsStrip.tsx
import type { SystemStats } from '../types/hq.js';

interface Props { stats: SystemStats | null; }

const STAT_ITEMS = [
  { key: 'bullActive', label: 'Jobs Running',  cls: 'c-blue',   fmt: (s: SystemStats) => String(s.bullActive) },
  { key: 'cpu',        label: 'CPU Load',      cls: 'c-amber',  fmt: (s: SystemStats) => `${s.cpu}` },
  { key: 'mem',        label: 'RAM',           cls: 'c-text',   fmt: (s: SystemStats) => `${(s.mem / 1024).toFixed(1)}/${(s.memTotal / 1024).toFixed(1)} GB` },
  { key: 'tokens',     label: 'Tokens Today',  cls: 'c-cyan',   fmt: (s: SystemStats) => s.tokensToday >= 1_000_000 ? `${(s.tokensToday / 1_000_000).toFixed(2)}M` : s.tokensToday >= 1000 ? `${(s.tokensToday / 1000).toFixed(0)}k` : String(s.tokensToday) },
  { key: 'disk',       label: 'Disk',          cls: 'c-text',   fmt: (s: SystemStats) => `${(s.diskUsed / 1024).toFixed(0)}/${(s.diskTotal / 1024).toFixed(0)} GB` },
  { key: 'cost',       label: 'Est. API Cost', cls: 'c-purple', fmt: (s: SystemStats) => `$${s.costToday.toFixed(2)}` },
];

export function StatsStrip({ stats }: Props) {
  const isActive = (key: string, s: SystemStats): boolean => {
    switch (key) {
      case 'bullActive': return s.bullActive > 0;
      case 'cpu': return s.cpu > 5;
      case 'mem': return s.mem > 0;
      case 'tokens': return s.tokensToday > 0;
      case 'disk': return s.diskUsed > 0;
      case 'cost': return s.costToday > 0;
      default: return false;
    }
  };

  return (
    <div className="stats-strip">
      {STAT_ITEMS.map(({ key, label, cls, fmt }) => (
        <div key={key} className="ss">
          <span className="ss-key">{label}</span>
          <span className={`ss-val ${cls}${stats && isActive(key, stats) ? ' pulse' : ''}`}>
            {stats === null ? '…' : fmt(stats)}
          </span>
        </div>
      ))}
    </div>
  );
}
