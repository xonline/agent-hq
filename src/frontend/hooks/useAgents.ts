import { useState, useCallback } from 'react';
import type { AgentInfo } from '../types/hq.js';
import { AGENT_ROSTER } from '../types/hq.js';
import type { HQEvent } from '../types/hq.js';

export function useAgents() {
  const [agentMap, setAgentMap] = useState<Record<string, { state: string; text?: string }>>(() =>
    Object.fromEntries(AGENT_ROSTER.map(a => [a.id, { state: 'idle' }]))
  );

  const handleEvent = useCallback((event: HQEvent) => {
    // Normalise agent IDs — delegate.ts emits uppercase ('CTO'), roster uses lowercase ('cto')
    if (event.type === 'agent:start') {
      const id = event.agent.toLowerCase();
      // For extra jarvis sessions (jarvis-2, jarvis-3 etc.), update the primary jarvis state
      const rosterKey = id.startsWith('jarvis') ? 'jarvis' : id;
      setAgentMap(m => ({ ...m, [rosterKey]: { state: 'working', text: event.text } }));
    } else if (event.type === 'agent:complete') {
      const id = event.agent.toLowerCase();
      const rosterKey = id.startsWith('jarvis') ? 'jarvis' : id;
      // Only go idle if this was the last active session (handled via stats jarvisSessions)
      if (rosterKey !== 'jarvis') {
        setAgentMap(m => ({ ...m, [rosterKey]: { state: 'idle' } }));
      }
    } else if (event.type === 'agent:error') {
      const id = event.agent.toLowerCase();
      const rosterKey = id.startsWith('jarvis') ? 'jarvis' : id;
      setAgentMap(m => ({ ...m, [rosterKey]: { state: 'error', text: event.error } }));
    } else if (event.type === 'stats') {
      // Sync jarvis state from authoritative session count
      const count = event.jarvisSessions ?? 0;
      setAgentMap(m => ({
        ...m,
        jarvis: count > 0
          ? { ...m['jarvis'], state: 'working' }
          : { state: 'idle' },
      }));
    }
  }, []);

  const agents: AgentInfo[] = AGENT_ROSTER.map(a => ({
    ...a,
    state: (agentMap[a.id]?.state ?? 'idle') as AgentInfo['state'],
    text: agentMap[a.id]?.text,
  }));

  return { agents, handleEvent };
}
