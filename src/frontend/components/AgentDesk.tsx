// trigger-agents/src/frontend/components/AgentDesk.tsx
import type { AgentInfo } from '../types/hq.js';

interface Props {
  agent: AgentInfo;
  filter: 'all' | 'csuite' | 'tony' | 'active' | 'jarvis';
  sessionCount?: number;
}

// Darken a hex colour by mixing toward black
function darken(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.round(c * (1 - ratio));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}

// Pixel character SVG — 12×22 viewBox, 24×44 rendered
function PixelChar({ colour, state, agentId }: { colour: string; state: string; agentId: string }) {
  const body = colour;
  const bodyDark = darken(colour, 0.35);
  const bodyDarker = darken(colour, 0.65);
  const skin = '#c8b898';
  const hair = darken(colour, 0.82);

  // Map agent IDs to working animations
  const getWorkingAnimation = (id: string): string => {
    switch (id) {
      case 'james':  return 'type 0.35s step-start infinite';
      case 'cto':    return 'cto-flicker 0.6s ease-in-out infinite';
      case 'cmo':    return 'cmo-broadcast 1.2s ease-in-out infinite';
      case 'cfo':    return 'cfo-tally 1.0s ease-in-out infinite';
      case 'coo':    return 'coo-rhythm 1.4s ease-in-out infinite';
      case 'cro':    return 'cro-bounce 0.8s ease-in-out infinite';
      case 'cpo':    return 'cpo-sway 1.3s ease-in-out infinite';
      case 'csao':   return 'csao-lean 1.5s ease-in-out infinite';
      case 'cxo':    return 'cxo-pulse 1.6s ease-in-out infinite';
      case 'qc':     return 'qc-scan 0.9s ease-in-out infinite';
      case 'tony':   return 'tony-relax 1.1s ease-in-out infinite';
      default:       return 'type 0.35s step-start infinite';
    }
  };

  const animStyle: React.CSSProperties =
    state === 'working'
      ? { animation: getWorkingAnimation(agentId) }
      : state === 'queued'
      ? { animation: 'idle-bob 1.8s ease-in-out infinite' }
      : { animation: 'idle-bob 3s ease-in-out infinite' };

  return (
    <svg className="px-char" width={24} height={44} viewBox="0 0 12 22" style={animStyle}>
      {/* Head */}
      <rect x={3} y={0} width={6} height={6} fill={skin} />
      {/* Hair */}
      <rect x={3} y={0} width={6} height={2} fill={hair} />
      {/* Eyes */}
      <rect x={4} y={3} width={2} height={1} fill="#1a1a2a" />
      <rect x={6} y={3} width={2} height={1} fill="#1a1a2a" />
      {/* Torso */}
      <rect x={2} y={6} width={8} height={7} fill={body} />
      {/* Collar / shirt */}
      <rect x={4} y={6} width={4} height={3} fill="#e8e8f0" />
      <rect x={5} y={7} width={2} height={5} fill={bodyDark} />
      {/* Upper arms */}
      <rect x={2} y={6} width={2} height={4} fill={bodyDark} />
      <rect x={8} y={6} width={2} height={4} fill={bodyDark} />
      {/* Lower arms */}
      <rect x={0} y={7} width={2} height={5} fill={body} />
      <rect x={10} y={7} width={2} height={5} fill={body} />
      {/* Hands */}
      <rect x={0} y={12} width={2} height={2} fill={skin} />
      <rect x={10} y={12} width={2} height={2} fill={skin} />
      {/* Legs */}
      <rect x={2} y={13} width={3} height={7} fill={bodyDarker} />
      <rect x={7} y={13} width={3} height={7} fill={bodyDarker} />
      {/* Shoes */}
      <rect x={1} y={20} width={4} height={2} fill="#080410" />
      <rect x={7} y={20} width={4} height={2} fill="#080410" />
    </svg>
  );
}

// Monitor layout for Jarvis multi-session desk: true = regular, false = small
function getMonitorSizes(count: number): boolean[] {
  if (count <= 1) return [true];
  if (count === 2) return [true, true];
  if (count === 3) return [false, true, false];
  if (count === 4) return [false, true, true, false];
  return [false, false, true, false, false];
}

// Map agent → monitor glow class when active
const MONITOR_CLASS: Record<string, string> = {
  james: 'on-work',
  cto:   'on-blue',
  cxo:   'on-blue',
  cmo:   'on-work',
  cfo:   'on-ambe',
  coo:   'on-ambe',
  cro:   'on-ambe',
  cpo:   'on-purp',
  csao:  'on-purp',
  jarvis:'on-purp',
  qc:    'on-ambe',
  tony:  'on-ambe',
};

const CSUITE_IDS = ['cto', 'cmo', 'cfo', 'coo', 'cro', 'cpo', 'csao', 'cxo', 'qc'];

export function AgentDesk({ agent, filter, sessionCount = 1 }: Props) {
  const { id, handle, role, state, text, colour } = agent;

  const visible =
    filter === 'all' ||
    (filter === 'csuite' && (id === 'james' || CSUITE_IDS.includes(id))) ||
    (filter === 'tony'   && id === 'tony') ||
    (filter === 'jarvis' && id.startsWith('jarvis')) ||
    (filter === 'active' && state !== 'idle');

  if (!visible) return null;

  const isIdle    = state === 'idle';
  const isWorking = state === 'working';
  const isQueued  = (state as string) === 'queued';
  const isError   = state === 'error';
  const isJarvis  = id.startsWith('jarvis');

  // Desk CSS class
  const deskClass = [
    'desk',
    isJarvis && !isIdle ? 'jarvis-desk' : state,
  ].filter(Boolean).join(' ');

  // Monitor glow class (only when non-idle)
  const monitorGlow = isIdle ? '' : isError ? 'on-red' : (MONITOR_CLASS[id] ?? (isJarvis ? 'on-purp' : 'on-work'));

  // Badge
  let badge: React.ReactNode = null;
  if (isJarvis && !isIdle) {
    badge = <div className="desk-badge you">{sessionCount > 1 ? `YOU ×${sessionCount}` : 'YOU'}</div>;
  } else if (isWorking) {
    badge = <div className="desk-badge wk">WORKING</div>;
  } else if (isQueued) {
    badge = <div className="desk-badge qu">QUEUED</div>;
  } else if (isError) {
    badge = <div className="desk-badge er">ERROR</div>;
  }

  // Typing dot colour
  const dotColour = isError ? 'var(--red)' : isJarvis ? 'var(--purple)' : colour;

  // Sdot + task text
  const sdotClass = isWorking ? 'g' : isQueued ? 'a' : isError ? 'r' : 'd';
  const taskText = isWorking && text ? text : isWorking ? 'Working…' : isQueued ? 'Queued — waiting' : isError ? 'Error' : 'Idle';

  // Avatar letter (Jarvis variants = "Jv", others = first letter of handle)
  const avatarLetter = isJarvis ? 'Jv' : handle.charAt(0);
  const avatarBg = darken(colour, 0.7);

  return (
    <div className={deskClass}>
      {badge}

      {/* Typing indicator for active agents */}
      {!isIdle && (
        <div className="typing-indicator">
          <div className="typing-dot" style={{ background: dotColour }} />
          <div className="typing-dot" style={{ background: dotColour }} />
          <div className="typing-dot" style={{ background: dotColour }} />
        </div>
      )}

      {/* Desk scene */}
      <div className="desk-scene">
        <div className="desk-surface" />
        {isJarvis && !isIdle ? (
          <div className="jarvis-monitors">
            {getMonitorSizes(Math.min(sessionCount, 5)).map((big, i) => (
              <div key={i} className="jmon">
                <div className={`jmon-screen${big ? '' : ' sm'}`} style={big ? { marginBottom: '4px' } : {}} />
                <div className="jmon-stand" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={`desk-monitor${monitorGlow ? ' ' + monitorGlow : ''}`} />
            {!isIdle && <PixelChar colour={colour} state={state} agentId={id} />}
          </>
        )}
      </div>

      {/* Desk info */}
      <div className="desk-info">
        <div className="di-row">
          <div className="di-avatar" style={{ background: avatarBg, color: colour }}>
            {avatarLetter}
          </div>
          <div>
            <div className="di-name">{handle}</div>
            <div className="di-role">{role}</div>
          </div>
        </div>
        <div className="di-task">
          <span className={`sdot ${sdotClass}`} />
          {taskText}
        </div>
      </div>
    </div>
  );
}
