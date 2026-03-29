import { Queue, QueueEvents } from 'bullmq';
import { redis } from './redis.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConnectionOptions = any;

export interface MessageJob {
  botId: 'james' | 'tony';
  chatId: number;
  messageId: number;
  userId: number;
  username?: string;
  text: string;
  imagePath?: string;  // local path to downloaded image (photos/screenshots from Telegram)
  timestamp: number;
  _escalations?: number; // number of Jarvis escalation cycles on this message
}

// One queue per bot (cast needed as BullMQ bundles its own ioredis)
export const jamesQueue = new Queue<MessageJob>('james', { connection: redis as AnyConnectionOptions });
export const tonyQueue = new Queue<MessageJob>('tony', { connection: redis as AnyConnectionOptions });

export const jamesEvents = new QueueEvents('james', { connection: redis as AnyConnectionOptions });
export const tonyEvents = new QueueEvents('tony', { connection: redis as AnyConnectionOptions });
