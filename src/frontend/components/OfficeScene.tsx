// trigger-agents/src/frontend/components/OfficeScene.tsx
import { AgentDesk } from './AgentDesk.js';
import type { AgentInfo } from '../types/hq.js';

type Filter = 'all' | 'csuite' | 'tony' | 'active' | 'jarvis';

interface Props {
  agents: AgentInfo[];
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  jarvisSessions?: number;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'csuite', label: 'James + C-Suite' },
  { key: 'tony',   label: 'Tony' },
  { key: 'jarvis', label: 'Jarvis' },
  { key: 'active', label: 'Active only' },
];

export function OfficeScene({ agents, filter, onFilterChange, jarvisSessions = 0 }: Props) {
  const working = agents.filter(a => a.state === 'working').length;
  const idle    = agents.filter(a => a.state === 'idle').length;
  const errors  = agents.filter(a => a.state === 'error').length;
  const total   = agents.length;

  const statusParts: string[] = [];
  if (working > 0) statusParts.push(`${working} active`);
  if (errors > 0)  statusParts.push(`${errors} error`);
  if (idle > 0)    statusParts.push(`${idle} idle`);

  // Split agents into rows of 4 for the desks-grid
  const rows: AgentInfo[][] = [];
  for (let i = 0; i < agents.length; i += 4) {
    rows.push(agents.slice(i, i + 4));
  }

  return (
    <div className="office">
      <div className="floor-hdr">
        <h2>// c-suite floor</h2>
        <div className="filter-row">
          {FILTERS.map(({ key, label }) => (
            <div
              key={key}
              className={`fpill${filter === key ? ' on' : ''}`}
              onClick={() => onFilterChange(key)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="pixel-scene">
        <div className="room-label">
          ↳ {total} agents — {statusParts.join(' · ')}
        </div>

        {rows.map((row, i) => (
          <div key={i} className="desks-grid">
            {row.map(agent => (
              <AgentDesk key={agent.id} agent={agent} filter={filter} sessionCount={agent.id === 'jarvis' ? Math.max(1, jarvisSessions) : 1} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
