/**
 * Example Agent — demonstrates how to wire an agent into Agent HQ
 *
 * This pattern works for any agent: Claude Code, LangChain, AutoGen, etc.
 * The agent emits status events that the HQ dashboard displays in real-time.
 *
 * TWO APPROACHES:
 *   A) In-process: emitAgentEvent()     — use when agent runs in same Node.js process as server
 *   B) Cross-process: publishAgentEvent() — use when agent is a separate process (recommended)
 */

// ─── Approach A: In-process ───────────────────────────────────────────────────
// Import and call directly — events go straight to the SSE broadcast hub

import { emitAgentEvent } from '../lib/agentRegistry.js';

async function runInProcessAgent() {
  const AGENT_ID = 'my-agent'; // must match an id in AGENT_ROSTER (types/hq.ts)

  try {
    // Signal the dashboard: agent is now working
    emitAgentEvent(AGENT_ID, 'working', { task: 'Fetching data from API' });

    // ... do your actual work here ...
    await new Promise(resolve => setTimeout(resolve, 2000)); // simulate work

    // Signal the dashboard: task complete, back to idle
    emitAgentEvent(AGENT_ID, 'idle', { lastTask: 'Fetched 42 records' });

  } catch (err) {
    // Signal the dashboard: something went wrong
    emitAgentEvent(AGENT_ID, 'error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


// ─── Approach B: Cross-process via Redis ──────────────────────────────────────
// Use when your agent is a separate process, container, or written in another language
// Requires Redis + REDIS_URL in .env

import { publishAgentEvent } from '../lib/agentEventBus.js';

async function runCrossProcessAgent() {
  const AGENT_ID = 'my-agent';

  try {
    // Publish to Redis — the HQ server subscribes and broadcasts to all SSE clients
    await publishAgentEvent(AGENT_ID, 'working', { task: 'Analysing documents' });

    await new Promise(resolve => setTimeout(resolve, 2000));

    await publishAgentEvent(AGENT_ID, 'idle', { lastTask: 'Analysed 5 documents' });

  } catch (err) {
    await publishAgentEvent(AGENT_ID, 'error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


// ─── Agent Status Values ──────────────────────────────────────────────────────
//
//   'idle'    — agent is available, not doing anything
//   'working' — agent is actively processing a task
//   'error'   — agent encountered a problem
//
// The optional payload object can contain any JSON-serialisable data.
// It appears in the Live Feed on the dashboard.


// ─── Adding Your Agent to the Roster ─────────────────────────────────────────
//
// Edit src/frontend/types/hq.ts and add to AGENT_ROSTER:
//
//   { id: 'my-agent', label: 'My Agent', icon: '🤖', description: 'What it does' }
//
// The id must match what you pass to emitAgentEvent / publishAgentEvent.


// Run one of the examples
runInProcessAgent().catch(console.error);
