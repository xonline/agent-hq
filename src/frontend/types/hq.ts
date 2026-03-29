// trigger-agents/src/frontend/types/hq.ts

export type AgentId = 'james' | 'cto' | 'cmo' | 'cfo' | 'coo' | 'cro' | 'cpo' | 'csao' | 'cxo' | 'qc' | 'tony' | 'jarvis';

export type AgentState = 'idle' | 'working' | 'error';

export interface AgentInfo {
  id: string;
  handle: string;
  role: string;
  colour: string;
  state: AgentState;
  text?: string;
}

export type TaskCategory = 'business' | 'systems' | 'research' | 'general' | 'deferred';

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
}

export interface KanbanBoard {
  backlog: KanbanCard[];
  inProgress: KanbanCard[];
  review: KanbanCard[];
  done: KanbanCard[];
}

export interface SystemStats {
  sessions: number;
  bullActive: number;
  bullWaiting: number;
  cpu: number;
  mem: number;
  memTotal: number;
  diskUsed: number;
  diskTotal: number;
  tokensToday: number;
  costToday: number;
  jarvisSessions?: number;
}

export interface FeedEntry {
  id: string;
  ts: string;
  epoch: number;
  agent: AgentId | string;
  colour: string;
  message: string;
  detail?: string;
}

export type HQEvent =
  | { type: 'agent:start';    agent: string; jobId: string; text: string; epoch?: number }
  | { type: 'agent:complete'; agent: string; jobId: string; durationMs: number; epoch?: number }
  | { type: 'agent:error';    agent: string; jobId: string; error: string; epoch?: number }
  | { type: 'stats';          sessions: number; bullActive: number; bullWaiting: number; cpu: number; mem: number; memTotal: number; diskUsed: number; diskTotal: number; tokensToday: number; costToday: number; jarvisSessions?: number }
  | { type: 'heartbeat' }
  | { type: 'connected';      ts: string };

export const AGENT_ROSTER: Omit<AgentInfo, 'state' | 'text'>[] = [
  { id: 'james',  handle: 'James',  role: 'CEO',                  colour: '#6366f1' },
  { id: 'cto',    handle: 'CTO',    role: 'Chief Technology',      colour: '#3b82f6' },
  { id: 'cmo',    handle: 'CMO',    role: 'Chief Marketing',       colour: '#22c55e' },
  { id: 'cfo',    handle: 'CFO',    role: 'Chief Finance',         colour: '#f59e0b' },
  { id: 'coo',    handle: 'COO',    role: 'Chief Operations',      colour: '#22d3ee' },
  { id: 'cro',    handle: 'CRO',    role: 'Chief Revenue',         colour: '#f97316' },
  { id: 'cpo',    handle: 'CPO',    role: 'Chief Product',         colour: '#a78bfa' },
  { id: 'csao',   handle: 'CSAO',   role: 'Chief Strategy & AI',   colour: '#ec4899' },
  { id: 'cxo',    handle: 'CXO',    role: 'Chief Experience',      colour: '#14b8a6' },
  { id: 'qc',     handle: 'QC',     role: 'Quality Control',       colour: '#ef4444' },
  { id: 'tony',   handle: 'Tony',   role: 'Personal Coach',        colour: '#eab308' },
  { id: 'jarvis', handle: 'Jarvis', role: 'Orchestrator',          colour: '#e2e8f0' },
];
