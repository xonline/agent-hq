// trigger-agents/src/frontend/components/LogsView.tsx
import { useRef, useEffect, useState } from 'react';
import type { FeedEntry } from '../types/hq.js';

interface Props {
  entries: FeedEntry[];
}

function lineClass(message: string): string {
  if (message.startsWith('✗') || message.includes('error')) return 'll-error';
  if (message.startsWith('✓') || message.includes('complete')) return 'll-done';
  if (message.includes('active') || message.includes('start') || message.includes('Working')) return 'll-start';
  return 'll-info';
}

export function LogsView({ entries }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div className="view-logs">
      <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed var(--border2)' }}>
        // system log — {entries.length} events
      </div>
      {entries.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-xs)' }}>No events yet…</div>
      ) : (
        [...entries].reverse().map(e => {
          const isExpanded = expandedDetail === e.id;
          const hasDetail = e.detail !== undefined;
          const retryBadge = retryStatus[e.id];
          return (
            <div key={e.id} style={{ marginBottom: '4px' }}>
              <div
                className={`log-line ${lineClass(e.message)}`}
                style={{ cursor: hasDetail ? 'pointer' : 'default' }}
                onClick={() => hasDetail && setExpandedDetail(isExpanded ? null : e.id)}
              >
                <span className="log-ts">{e.ts}</span>
                <span className="log-agent" style={{ color: e.colour }}>{e.agent}</span>
                <span className="log-msg">{e.message}</span>
                {hasDetail && (
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)', color: 'var(--text3)' }}>
                    {isExpanded ? '▼' : '▶'} details
                  </span>
                )}
                {retryBadge && (
                  <span style={{ marginLeft: '8px', fontSize: 'var(--fs-xs)', padding: '0 6px', background: 'var(--green)', color: '#000', borderRadius: '2px', fontWeight: 'bold' }}>
                    {retryBadge}
                  </span>
                )}
              </div>
              {isExpanded && hasDetail && (
                <div style={{ marginTop: '4px', paddingLeft: '8px', paddingRight: '4px', borderLeft: '2px solid var(--border2)', fontSize: 'var(--fs-xs)', color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflow: 'auto' }}>
                  {e.detail}
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={endRef} />
    </div>
  );
}
