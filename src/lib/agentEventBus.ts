/**
 * agentEventBus.ts
 *
 * Redis pub/sub bridge for agent events across the server/worker process boundary.
 *
 * Worker process  → publishes to Redis channel `hq:agent-events`
 * Server process  → subscribes and relays to SSE clients via broadcastHQEvent
 *
 * Using ioredis directly (BullMQ's redis config is connection options only).
 */

import IORedis from 'ioredis';
import type { AgentEvent } from './agentRegistry.js';

const CHANNEL = 'hq:agent-events';

function makeRedisClient(): IORedis {
  return new IORedis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6380),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
}

let _publisher: IORedis | null = null;

export function getPublisher(): IORedis {
  if (!_publisher) {
    _publisher = makeRedisClient();
    _publisher.on('error', (err) => {
      console.warn('[agentEventBus:pub] Redis error:', err.message);
    });
  }
  return _publisher;
}

/** Publish an agent event to Redis so the server process can relay it to SSE clients. */
export async function publishAgentEvent(event: AgentEvent): Promise<void> {
  try {
    await getPublisher().publish(CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.warn('[agentEventBus] failed to publish event:', (err as Error).message);
  }
}

/**
 * Subscribe to agent events published by the worker.
 * Call this once in the server process. The handler receives each AgentEvent.
 */
export function subscribeAgentEvents(handler: (event: AgentEvent & { epoch: number }) => void): void {
  const sub = makeRedisClient();
  sub.on('error', (err) => {
    console.warn('[agentEventBus:sub] Redis error:', err.message);
  });
  sub.subscribe(CHANNEL, (err) => {
    if (err) console.error('[agentEventBus:sub] subscribe failed:', err.message);
    else console.log('[agentEventBus:sub] subscribed to', CHANNEL);
  });
  sub.on('message', (_channel, message) => {
    try {
      const event = JSON.parse(message) as AgentEvent;
      handler({ ...event, epoch: Date.now() });
    } catch (err) {
      console.warn('[agentEventBus:sub] bad message:', (err as Error).message);
    }
  });
}
