// trigger-agents/src/frontend/components/LiveStats.tsx
import type { SystemStats } from '../types/hq.js';
import type { FeedEntry } from '../types/hq.js';

interface Props {
  stats: SystemStats | null;
  entries: FeedEntry[];
}

export function LiveStats({ stats, entries }: Props) {
  const errorCount = entries.filter(e => e.message.startsWith('✗')).length;

  const fmtTokens = (t: number) =>
    t >= 1_000_000 ? `${(t / 1_000_000).toFixed(2)}M`
    : t >= 1000    ? `${(t / 1000).toFixed(0)}k`
    : String(t);

  const memPct = stats ? Math.round(stats.mem / stats.memTotal * 100) : null;
  const diskPct = stats ? Math.round(stats.diskUsed / stats.diskTotal * 100) : null;

  return (
    <div className="lstats-panel">
      <div className="lstats-hdr">Live Stats</div>
      <div className="lstats-grid">

        {/* Row 1 — jobs */}
        <div className="lscard">
          <div className="lscard-key">Active</div>
          <div className="lscard-val c-green">{stats?.bullActive ?? '—'}</div>
        </div>
        <div className="lscard">
          <div className="lscard-key">Waiting</div>
          <div className="lscard-val c-amber">{stats?.bullWaiting ?? '—'}</div>
        </div>
        <div className="lscard">
          <div className="lscard-key">Errors</div>
          <div className="lscard-val c-red">{errorCount}</div>
        </div>

        {/* Row 2 — hardware */}
        <div className="lscard">
          <div className="lscard-key">RAM</div>
          <div className="lscard-val c-text" style={{ fontSize: 'var(--fs-xs)' }}>
            {stats ? `${(stats.mem / 1024).toFixed(1)}/${(stats.memTotal / 1024).toFixed(1)} GB` : '—'}
          </div>
          {memPct !== null && <div className="lscard-pct">{memPct}%</div>}
        </div>
        <div className="lscard">
          <div className="lscard-key">Disk</div>
          <div className="lscard-val c-text" style={{ fontSize: 'var(--fs-xs)' }}>
            {stats ? `${(stats.diskUsed / 1024).toFixed(0)}/${(stats.diskTotal / 1024).toFixed(0)} GB` : '—'}
          </div>
          {diskPct !== null && <div className="lscard-pct">{diskPct}%</div>}
        </div>
        <div className="lscard">
          <div className="lscard-key">CPU</div>
          <div className="lscard-val c-amber">{stats ? `${stats.cpu}%` : '—'}</div>
        </div>

        {/* Row 3 — usage/cost (2-col even split) */}
        <div className="lstats-row3">
          <div className="lscard">
            <div className="lscard-key">Tokens Today</div>
            <div className="lscard-val c-cyan" style={{ fontSize: 'var(--fs-xs)' }}>
              {stats ? fmtTokens(stats.tokensToday) : '—'}
            </div>
          </div>
          <div className="lscard">
            <div className="lscard-key">Est. Cost</div>
            <div className="lscard-val c-purple" style={{ fontSize: 'var(--fs-xs)' }}>
              {stats ? `$${stats.costToday.toFixed(2)}` : '—'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
