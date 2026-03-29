// trigger-agents/src/frontend/components/LiveFeed.tsx
import { useRef, useEffect, useState } from 'react';
import type { FeedEntry, AgentId, AgentState } from '../types/hq.js';
import { JobDetailModal } from './JobDetailModal.js';

interface Props {
  entries: FeedEntry[];
  filter?: 'all' | 'csuite' | 'tony' | 'active' | 'jarvis';
  agents?: Record<AgentId | string, { state: AgentState }>;
}

type Tab = 'feed' | 'history';

const CSUITE: AgentId[] = ['cto', 'cmo', 'cfo', 'coo', 'cro', 'cpo', 'csao', 'cxo', 'qc'];

function extractJobId(entryId: string): string | null {
  const parts = entryId.split(':');
  if (parts.length >= 3) return parts.slice(1, parts.length - 1).join(':');
  return null;
}

export function LiveFeed({ entries, filter = 'all', agents = {} }: Props) {
  const [tab, setTab] = useState<Tab>('feed');
  const [selectedEntry, setSelectedEntry] = useState<FeedEntry | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'feed') endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, tab]);

  const filtered = entries.filter(e => {
    if (filter === 'all')    return true;
    if (filter === 'csuite') return e.agent === 'james' || CSUITE.includes(e.agent as AgentId);
    if (filter === 'tony')   return e.agent === 'tony';
    if (filter === 'jarvis') return e.agent === 'jarvis';
    if (filter === 'active') return agents[e.agent]?.state === 'working';
    return true;
  });

  // Split into "now" (last 5 min) and "earlier"
  const NOW_MS = 5 * 60 * 1000;
  const cutoff = Date.now() - NOW_MS;
  const recent = filtered.slice(-20);
  const nowEntries     = recent.filter(e => e.epoch >= cutoff);
  const earlierEntries = recent.filter(e => e.epoch < cutoff);

  return (
    <>
      <div className="feed-panel rpanel">
        <div className="rp-tabs">
          <div className={`rpt${tab === 'feed' ? ' on' : ''}`} onClick={() => setTab('feed')}>Live Feed</div>
          <div className={`rpt${tab === 'history' ? ' on' : ''}`} onClick={() => setTab('history')}>History</div>
        </div>

        <div className="rp-body">
          {tab === 'feed' && (
            <>
              {filtered.length === 0 ? (
                <div className="ev-empty">No events yet — waiting for agents…</div>
              ) : (
                <>
                  {nowEntries.length > 0 && (
                    <>
                      <div className="ev-section">Now</div>
                      {nowEntries.map(e => <FeedEvent key={e.id} entry={e} onClick={() => setSelectedEntry(e)} />)}
                    </>
                  )}
                  {earlierEntries.length > 0 && (
                    <>
                      <div className="ev-section">Earlier</div>
                      {earlierEntries.map(e => <FeedEvent key={e.id} entry={e} onClick={() => setSelectedEntry(e)} />)}
                    </>
                  )}
                </>
              )}
              <div ref={endRef} />
            </>
          )}

          {tab === 'history' && (
            <>
              <div className="ev-section">All events ({entries.length})</div>
              {entries.length === 0 ? (
                <div className="ev-empty">No history yet</div>
              ) : (
                [...entries].reverse().map(e => <FeedEvent key={e.id} entry={e} onClick={() => setSelectedEntry(e)} />)
              )}
            </>
          )}
        </div>
      </div>

      {selectedEntry && (() => {
        const jobId = extractJobId(selectedEntry.id);
        return jobId ? (
          <JobDetailModal
            jobId={jobId}
            agent={selectedEntry.agent}
            onClose={() => setSelectedEntry(null)}
          />
        ) : null;
      })()}
    </>
  );
}

function FeedEvent({ entry, onClick }: { entry: FeedEntry; onClick: () => void }) {
  return (
    <div className="ev ev-clickable" onClick={onClick}>
      <div className="ev-bullet" style={{ background: entry.colour }} />
      <div className="ev-body">
        <b>{entry.agent}</b> — {entry.message}
      </div>
      <div className="ev-ts">{entry.ts}</div>
    </div>
  );
}
