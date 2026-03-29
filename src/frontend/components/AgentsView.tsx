// trigger-agents/src/frontend/components/AgentsView.tsx
import type { AgentInfo } from '../types/hq.js';

interface Props {
  agents: AgentInfo[];
}

function darken(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.round(c * (1 - ratio));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}

export function AgentsView({ agents }: Props) {
  return (
    <div className="view-agents">
      {agents.map(agent => {
        const avatarBg = darken(agent.colour, 0.7);
        const avatarLetter = agent.id === 'jarvis' ? 'Jv' : agent.handle.charAt(0);
        const cardClass = `agent-card${agent.state === 'working' ? ' ac-working' : agent.state === 'error' ? ' ac-error' : ''}`;
        const stateColour = agent.state === 'working' ? 'var(--green)' : agent.state === 'error' ? 'var(--red)' : 'var(--text3)';
        const sdotClass = agent.state === 'working' ? 'g' : agent.state === 'error' ? 'r' : 'd';
        return (
          <div key={agent.id} className={cardClass}>
            <div className="agent-card-avatar" style={{ background: avatarBg, color: agent.colour }}>
              {avatarLetter}
            </div>
            <div className="agent-card-name">{agent.handle}</div>
            <div className="agent-card-role">{agent.role}</div>
            <div className="agent-card-state" style={{ color: stateColour }}>
              <span className={`sdot ${sdotClass}`} />
              {agent.state === 'working' && agent.text ? agent.text.slice(0, 40) : agent.state}
            </div>
          </div>
        );
      })}
    </div>
  );
}
