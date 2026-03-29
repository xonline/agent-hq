// trigger-agents/src/frontend/components/JobDetailModal.tsx
import { useState, useEffect } from 'react';
import { authHeaders } from '../lib/auth.js';

interface JobData {
  id: string;
  agent?: string;
  state?: string;
  text?: string;
  data?: { message?: string; text?: string };
  result?: unknown;
  failedReason?: string;
  stacktrace?: string[];
  createdAt?: number;
  startedAt?: number;
  finishedAt?: number;
}

interface Props {
  jobId: string;
  agent: string;
  onClose: () => void;
}

export function JobDetailModal({ jobId, agent, onClose }: Props) {
  const [data, setData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() as Promise<JobData> : Promise.reject(r.statusText))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [jobId]);

  const resultText = data?.result
    ? typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)
    : null;
  const inputText = data?.text ?? data?.data?.message ?? data?.data?.text ?? null;

  return (
    <div className="jd-overlay" onClick={onClose}>
      <div className="jd-box" onClick={e => e.stopPropagation()}>
        <div className="jd-hdr">
          <span className="jd-agent">{agent}</span>
          <span className="jd-state" data-state={data?.state ?? ''}>{data?.state ?? '…'}</span>
          <button className="jd-close" onClick={onClose}>✕</button>
        </div>
        <div className="jd-body">
          {loading && <div className="jd-empty">Loading…</div>}
          {error && <div className="jd-empty c-red">Could not load: {error}</div>}
          {data && (
            <>
              {inputText && (
                <div className="jd-section">
                  <div className="jd-key">Session / Input</div>
                  <div className="jd-text">{inputText}</div>
                </div>
              )}
              {resultText && (
                <div className="jd-section">
                  <div className="jd-key">Result</div>
                  <div className="jd-text">{resultText.substring(0, 800)}{resultText.length > 800 ? '…' : ''}</div>
                </div>
              )}
              {data.failedReason && (
                <div className="jd-section">
                  <div className="jd-key c-red">Error</div>
                  <div className="jd-text c-red">{data.failedReason}</div>
                  {data.stacktrace && data.stacktrace.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: 'var(--fs-xs)', color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '150px', overflow: 'auto', background: 'var(--bg4)', padding: '6px', borderRadius: '2px' }}>
                      {data.stacktrace.join('\n')}
                    </div>
                  )}
                </div>
              )}
              <div className="jd-meta">
                {data.createdAt && <span>Created {new Date(data.createdAt).toLocaleTimeString('en-AU', { hour12: false })}</span>}
                {data.finishedAt && <span>Finished {new Date(data.finishedAt).toLocaleTimeString('en-AU', { hour12: false })}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
