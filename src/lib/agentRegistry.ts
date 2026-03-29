import type { Response } from 'express';
import { publishAgentEvent } from './agentEventBus.js';

export type AgentId = 'james' | 'cto' | 'cmo' | 'cfo' | 'coo' | 'cro' | 'cpo' | 'csao' | 'cxo' | 'qc' | 'tony' | 'jarvis';

export type AgentState = {
  state: 'idle' | 'working' | 'error';
  text?: string;
  jobId?: string;
};

export type AgentEvent =
  | { type: 'agent:start';    agent: string; jobId: string; text: string }
  | { type: 'agent:complete'; agent: string; jobId: string; durationMs: number }
  | { type: 'agent:error';    agent: string; jobId: string; error: string };

export type HQEvent =
  | AgentEvent
  | { type: 'stats'; sessions: number; bullActive: number; bullWaiting: number; cpu: number; mem: number; memTotal: number; diskUsed: number; diskTotal: number; tokensToday: number; costToday: number; jarvisSessions?: number }
  | { type: 'heartbeat' };

const ALL_AGENTS: AgentId[] = ['james', 'cto', 'cmo', 'cfo', 'coo', 'cro', 'cpo', 'csao', 'cxo', 'qc', 'tony', 'jarvis'];

function makeInitialState(): Record<string, AgentState> {
  return Object.fromEntries(ALL_AGENTS.map(id => [id, { state: 'idle' as const }]));
}

let agentStates: Record<string, AgentState> = makeInitialState();
const hqSseClients = new Set<Response>();

// Token/cost counters (updated from worker.ts)
export let tokensToday = 0;
export let costToday = 0;
export function addTokens(tokens: number, costUsd: number): void {
  tokensToday += tokens;
  costToday += costUsd;
}

export function resetAgentRegistry(): void {
  agentStates = makeInitialState();
}

export function addHQClient(res: Response): void {
  hqSseClients.add(res);
}

export function removeHQClient(res: Response): void {
  hqSseClients.delete(res);
}

export function getHQClientCount(): number {
  return hqSseClients.size;
}

export function getAgentStates(): Record<string, AgentState> {
  return { ...agentStates };
}

export function broadcastHQEvent(event: HQEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const deadClients: Response[] = [];
  for (const client of hqSseClients) {
    try {
      client.write(payload);
    } catch {
      deadClients.push(client);
    }
  }
  deadClients.forEach(client => hqSseClients.delete(client));
}

type EventLoggerFn = (event: AgentEvent & { epoch: number }) => void;
let _eventLogger: EventLoggerFn | null = null;
export function setEventLogger(fn: EventLoggerFn): void { _eventLogger = fn; }

export function emitAgentEvent(event: AgentEvent): void {
  const { agent } = event;
  if (!ALL_AGENTS.includes(agent as AgentId)) {
    console.error(`[agentRegistry] Unknown agent: ${agent}`);
    return;
  }
  if (event.type === 'agent:start') {
    agentStates[agent] = { state: 'working', text: event.text, jobId: event.jobId };
  } else if (event.type === 'agent:complete') {
    agentStates[agent] = { state: 'idle' };
  } else if (event.type === 'agent:error') {
    agentStates[agent] = { state: 'error', text: event.error, jobId: event.jobId };
  }
  if (_eventLogger) _eventLogger({ ...event, epoch: Date.now() });
  broadcastHQEvent(event);
  // Also publish to Redis so the server process (which holds SSE clients) can relay this event
  publishAgentEvent(event);
}
