import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import os from 'os';
import pg from 'pg';
import { getAgentStates, addHQClient, removeHQClient, getHQClientCount, broadcastHQEvent, setEventLogger } from './lib/agentRegistry.js';
import { subscribeAgentEvents } from './lib/agentEventBus.js';
import { parseTasks } from './lib/tasksParser.js';
import { execFileSync } from 'child_process';

// ─── Configuration ────────────────────────────────────────────────────────────
//
// TASKS_FILE:         Path to a TASKS.md file (markdown Kanban parsed by tasksParser).
//                     Set to '' to disable the tasks endpoint.
// CLAUDE_PROJECTS_DIR: Directory containing Claude Code session JSONL files.
//                     Used for token usage tracking. Set to '' to disable.
// TRENDS_DB_URL:      PostgreSQL connection string for the trends + config database.
//                     Set to '' to disable persistent trends (falls back to file log).
// TIMEZONE:           IANA timezone name used for date boundaries (e.g. 'America/New_York').
// SERVER_PORT:        Port for the main API + HQ frontend server (default: 3100).
//
const TASKS_FILE        = process.env.TASKS_FILE        ?? '';
const CLAUDE_PROJECTS_DIR = process.env.CLAUDE_PROJECTS_DIR ?? '';
const TRENDS_DB_URL     = process.env.TRENDS_DB_URL     ?? '';
const TIMEZONE          = process.env.TIMEZONE          ?? 'UTC';
const SERVER_PORT       = Number(process.env.SERVER_PORT ?? 3100);

// Pricing for token cost display (claude-sonnet-4-x defaults)
const INPUT_PRICE_PER_TOKEN  = Number(process.env.INPUT_PRICE_PER_TOKEN  ?? 3  / 1_000_000);
const OUTPUT_PRICE_PER_TOKEN = Number(process.env.OUTPUT_PRICE_PER_TOKEN ?? 15 / 1_000_000);

// ─── Date helper ─────────────────────────────────────────────────────────────
function getTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

// ─── Token scanner (reads Claude Code session JSONL files) ───────────────────
let cachedTokens    = 0;
let cachedCost      = 0;
let tokensCachedAt  = 0;
const TOKEN_CACHE_TTL_MS = 60_000;

async function scanTodayTokens(): Promise<{ tokens: number; cost: number }> {
  if (!CLAUDE_PROJECTS_DIR) return { tokens: 0, cost: 0 };
  const now = Date.now();
  if (now - tokensCachedAt < TOKEN_CACHE_TTL_MS) return { tokens: cachedTokens, cost: cachedCost };

  const todayPrefix = getTodayDateString();
  let totalInput = 0, totalOutput = 0;

  try {
    const files = fs.readdirSync(CLAUDE_PROJECTS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(CLAUDE_PROJECTS_DIR, f))
      .filter(fp => {
        try { return fs.statSync(fp).mtimeMs > now - 48 * 3600 * 1000; }
        catch { return false; }
      });

    for (const fp of files) {
      const rl = readline.createInterface({ input: fs.createReadStream(fp, { encoding: 'utf-8' }), crlfDelay: Infinity });
      for await (const line of rl) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'assistant') continue;
          if (!entry.timestamp?.startsWith(todayPrefix)) continue;
          const u = entry.message?.usage;
          if (!u) continue;
          totalInput  += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          totalOutput += (u.output_tokens ?? 0);
        } catch { /* skip */ }
      }
    }
  } catch { /* ignore if dir missing */ }

  cachedTokens = totalInput + totalOutput;
  cachedCost   = Math.round((totalInput * INPUT_PRICE_PER_TOKEN + totalOutput * OUTPUT_PRICE_PER_TOKEN) * 10000) / 10000;
  tokensCachedAt = now;
  return { tokens: cachedTokens, cost: cachedCost };
}

// ─── Active session detector (Claude Code JSONL-based) ───────────────────────
const SESSION_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

function getActiveSessionCount(): number {
  if (!CLAUDE_PROJECTS_DIR) return 0;
  try {
    const now = Date.now();
    return fs.readdirSync(CLAUDE_PROJECTS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .filter(f => {
        try { return now - fs.statSync(path.join(CLAUDE_PROJECTS_DIR, f)).mtimeMs < SESSION_ACTIVE_THRESHOLD_MS; }
        catch { return false; }
      }).length;
  } catch { return 0; }
}

function getActiveSessionJsonl(): string | null {
  if (!CLAUDE_PROJECTS_DIR) return null;
  try {
    const now = Date.now();
    const active = fs.readdirSync(CLAUDE_PROJECTS_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(CLAUDE_PROJECTS_DIR, f))
      .filter(fp => { try { return now - fs.statSync(fp).mtimeMs < SESSION_ACTIVE_THRESHOLD_MS; } catch { return false; } });
    if (active.length === 0) return null;
    return active.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  } catch { return null; }
}

function getSessionSummary(): string {
  const fp = getActiveSessionJsonl();
  if (!fp) return 'Claude Code session active';
  try {
    const content = fs.readFileSync(fp, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;
        if (entry.type !== 'user') continue;
        const payload = (entry.data ?? entry.message) as Record<string, unknown> | undefined;
        const c = payload?.content ?? (typeof payload === 'string' ? payload : undefined);
        let text = '';
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          for (const part of c as Array<{ type?: string; text?: string }>) {
            if (part.type === 'text' && part.text) { text = part.text; break; }
          }
        }
        if (text && !text.startsWith('<') && !text.startsWith('This session is being continued')) {
          return text.replace(/\n/g, ' ').substring(0, 80);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return 'Claude Code session active';
}

// ─── Disk stats ───────────────────────────────────────────────────────────────
function getDiskStats(): { diskUsed: number; diskTotal: number } {
  try {
    const out = execFileSync('df', ['-k', '/'], { encoding: 'utf-8' });
    const parts = out.trim().split('\n')[1].trim().split(/\s+/);
    return { diskUsed: parseInt(parts[2]) * 1024, diskTotal: parseInt(parts[1]) * 1024 };
  } catch { return { diskUsed: 0, diskTotal: 0 }; }
}

// ─── Persistent HQ event log ──────────────────────────────────────────────────
const REPLAY_MAX_EVENTS = 40;
const REPLAY_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8h
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const HQ_EVENTS_LOG_PATH = path.join(__dirname, '..', 'data', 'hq-events.jsonl');

function appendHQEventLog(event: Record<string, unknown>): void {
  const withEpoch = { ...event, epoch: (event.epoch as number) ?? Date.now() };
  try { fs.appendFileSync(HQ_EVENTS_LOG_PATH, JSON.stringify(withEpoch) + '\n'); } catch { /* ignore */ }
  if (TRENDS_DB_URL) persistHQEventToPG(withEpoch).catch(() => { /* ignore */ });
}

async function persistHQEventToPG(event: Record<string, unknown>): Promise<void> {
  let client: pg.Client | null = null;
  try {
    client = new pg.Client(TRENDS_DB_URL);
    await client.connect();
    const eventId = (event.id as string) || `${event.agent ?? 'sys'}-${event.epoch}`;
    await client.query(`
      INSERT INTO hq_events (event_id, type, agent, message, colour, detail, ts, epoch)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id) DO NOTHING
    `, [eventId, (event.type as string) || 'info', (event.agent as string) || null,
        (event.message as string) || '', (event.colour as string) || null,
        (event.detail as string) || null, (event.ts as string) || null, event.epoch as number]);
  } catch { /* ignore */ } finally {
    if (client) await client.end().catch(() => {});
  }
}

function loadRecentHQEvents(): Array<Record<string, unknown>> {
  try {
    const content = fs.readFileSync(HQ_EVENTS_LOG_PATH, 'utf-8');
    const cutoff = Date.now() - REPLAY_MAX_AGE_MS;
    return content.trim().split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
      .filter((e): e is Record<string, unknown> => e !== null && typeof e.epoch === 'number' && (e.epoch as number) > cutoff)
      .slice(-REPLAY_MAX_EVENTS);
  } catch { return []; }
}

// ─── PostgreSQL trends helpers ────────────────────────────────────────────────
const CLAUDE_PLANS: Record<string, { name: string; monthlyUsd: number }> = {
  pro:    { name: 'Claude Pro',     monthlyUsd: 20  },
  max5x:  { name: 'Claude Max 5×',  monthlyUsd: 100 },
  max20x: { name: 'Claude Max 20×', monthlyUsd: 200 },
  teams:  { name: 'Claude Teams',   monthlyUsd: 30  },
  api:    { name: 'API (pay-as-you-go)', monthlyUsd: 0 },
};

async function getTrendsConnection(): Promise<pg.Client> {
  const client = new pg.Client(TRENDS_DB_URL);
  await client.connect();
  return client;
}

async function getOrDetectPlan(client: pg.Client): Promise<{ key: string; name: string; monthlyUsd: number; detected: boolean }> {
  const cfg = await client.query("SELECT value FROM user_config WHERE key = 'plan_key'");
  if (cfg.rows.length > 0 && CLAUDE_PLANS[cfg.rows[0].value]) {
    const key = cfg.rows[0].value as string;
    return { key, ...CLAUDE_PLANS[key], detected: false };
  }
  const sess = await client.query(`
    SELECT COALESCE(AVG(sessions), 0)::float AS avg_sessions
    FROM daily_stats WHERE date >= CURRENT_DATE - INTERVAL '30 days' AND sessions > 0
  `);
  const avg = parseFloat(sess.rows[0]?.avg_sessions ?? '0');
  if (avg >= 30) return { key: 'max20x', ...CLAUDE_PLANS.max20x, detected: true };
  if (avg >= 8)  return { key: 'max5x',  ...CLAUDE_PLANS.max5x,  detected: true };
  return { key: 'pro', ...CLAUDE_PLANS.pro, detected: true };
}

async function recordDailyStats(): Promise<void> {
  if (!TRENDS_DB_URL) return;
  let client: pg.Client | null = null;
  try {
    const { tokens: totalTokens, cost } = await scanTodayTokens();
    const todayDateStr = getTodayDateString();
    const sessionCount = getActiveSessionCount();
    client = await getTrendsConnection();
    await client.query(`
      INSERT INTO daily_stats (date, tokens_in, tokens_out, cost_usd, jobs_completed, jobs_failed, sessions, updated_at)
      VALUES ($1, $2, $3, $4, 0, 0, $5, now())
      ON CONFLICT (date) DO UPDATE SET
        tokens_in = EXCLUDED.tokens_in, tokens_out = EXCLUDED.tokens_out,
        cost_usd = EXCLUDED.cost_usd, sessions = EXCLUDED.sessions, updated_at = now()
    `, [todayDateStr, totalTokens, 0, cost, sessionCount]);
  } catch (err) {
    console.error('[recordDailyStats]', (err as Error).message);
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

// ─── Init database tables on startup ─────────────────────────────────────────
if (TRENDS_DB_URL) {
  (async () => {
    let client: pg.Client | null = null;
    try {
      client = await getTrendsConnection();
      await client.query(`
        CREATE TABLE IF NOT EXISTS hq_events (
          event_id TEXT PRIMARY KEY, type TEXT NOT NULL, agent TEXT,
          message TEXT NOT NULL DEFAULT '', colour TEXT, detail TEXT, ts TEXT,
          epoch BIGINT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_hq_events_epoch ON hq_events(epoch DESC)`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_config (
          key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_stats (
          date DATE PRIMARY KEY, tokens_in BIGINT DEFAULT 0, tokens_out BIGINT DEFAULT 0,
          cost_usd NUMERIC(10,4) DEFAULT 0, jobs_completed INT DEFAULT 0, jobs_failed INT DEFAULT 0,
          sessions INT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('[db] tables ready');
    } catch (err) {
      console.error('[db-init]', (err as Error).message);
    } finally {
      if (client) await client.end().catch(() => {});
    }
  })();
}

// ─── Ensure data directory exists ─────────────────────────────────────────────
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Wire up persistent event logger
setEventLogger((e) => appendHQEventLog(e as unknown as Record<string, unknown>));

// Subscribe to agent events from the worker process (via Redis pub/sub)
subscribeAgentEvents((event) => {
  appendHQEventLog(event as unknown as Record<string, unknown>);
  broadcastHQEvent(event);
});

// ─── HQ Auth ──────────────────────────────────────────────────────────────────
const AUTH_CONFIG_PATH = path.join(__dirname, '..', 'data', 'hq-auth.json');

function getPasswordHash(): string | null {
  try { return (JSON.parse(fs.readFileSync(AUTH_CONFIG_PATH, 'utf8')) as Record<string, string>).passwordHash ?? null; }
  catch { return null; }
}
function hashPw(pw: string): string {
  return crypto.createHash('sha256').update('hq-v1:' + pw).digest('hex');
}
function requireHQAuth(req: Request, res: Response, next: NextFunction): void {
  const hash = getPasswordHash();
  if (!hash) { next(); return; }
  const token = (req.headers['x-hq-token'] as string | undefined) ?? (req.query.token as string | undefined);
  if (token === hash) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/auth/status', (_req, res) => {
  res.json({ protected: getPasswordHash() !== null });
});
app.post('/api/auth/login', (req, res) => {
  const hash = getPasswordHash();
  if (!hash) { res.json({ ok: true, token: null }); return; }
  const { password } = (req.body ?? {}) as { password?: string };
  if (hashPw(password ?? '') !== hash) { res.status(401).json({ error: 'Wrong password' }); return; }
  res.json({ ok: true, token: hash });
});
app.post('/api/auth/set-password', requireHQAuth, (req, res) => {
  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || password.length < 4) { res.status(400).json({ error: 'Minimum 4 characters' }); return; }
  const newHash = hashPw(password);
  fs.mkdirSync(path.dirname(AUTH_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify({ passwordHash: newHash }));
  res.json({ ok: true, token: newHash });
});
app.post('/api/auth/clear-password', requireHQAuth, (_req, res) => {
  try { fs.writeFileSync(AUTH_CONFIG_PATH, JSON.stringify({})); } catch { /* ignore */ }
  res.json({ ok: true });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── GET /api/agents ─────────────────────────────────────────────────────────
app.get('/api/agents', requireHQAuth, (_req, res) => {
  res.json(getAgentStates());
});

// ─── GET /api/tasks ──────────────────────────────────────────────────────────
app.get('/api/tasks', requireHQAuth, (_req, res) => {
  if (!TASKS_FILE) { res.json({ backlog: [], inProgress: [], review: [], done: [] }); return; }
  try {
    const raw = fs.readFileSync(TASKS_FILE, 'utf8');
    res.json(parseTasks(raw));
  } catch {
    res.json({ backlog: [], inProgress: [], review: [], done: [] });
  }
});

// ─── GET /api/stats ──────────────────────────────────────────────────────────
app.get('/api/stats', requireHQAuth, async (_req, res) => {
  const { tokens, cost } = await scanTodayTokens();
  const cpuLoad = os.loadavg()[0];
  const { diskUsed, diskTotal } = getDiskStats();
  const sessionCount = getActiveSessionCount();
  res.json({
    sessions: getHQClientCount(),
    bullActive: sessionCount,
    bullWaiting: 0,
    cpu: Math.round(cpuLoad * 100) / 100,
    mem: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
    memTotal: Math.round(os.totalmem() / 1024 / 1024),
    diskUsed: Math.round(diskUsed / 1024 / 1024),
    diskTotal: Math.round(diskTotal / 1024 / 1024),
    tokensToday: tokens,
    costToday: cost,
    jarvisSessions: sessionCount,
  });
});

// ─── GET /api/hq-log ─────────────────────────────────────────────────────────
app.get('/api/hq-log', requireHQAuth, async (req, res) => {
  const limitParam = Math.min(parseInt((req.query.limit as string) ?? '200', 10), 500);
  if (TRENDS_DB_URL) {
    let client: pg.Client | null = null;
    try {
      client = await getTrendsConnection();
      const result = await client.query(
        `SELECT event_id, type, agent, message, colour, detail, ts, epoch FROM hq_events ORDER BY epoch DESC LIMIT $1`,
        [limitParam]
      );
      res.json(result.rows.reverse());
      return;
    } catch (err) {
      console.error('[hq-log]', (err as Error).message);
    } finally {
      if (client) await client.end().catch(() => {});
    }
  }
  res.json(loadRecentHQEvents());
});

// ─── GET /api/config ─────────────────────────────────────────────────────────
app.get('/api/config', requireHQAuth, async (_req, res) => {
  if (!TRENDS_DB_URL) { res.json({ plan: { key: 'api', ...CLAUDE_PLANS.api, detected: true } }); return; }
  let client: pg.Client | null = null;
  try {
    client = await getTrendsConnection();
    const plan = await getOrDetectPlan(client);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  } finally {
    if (client) await client.end().catch(() => {});
  }
});

// ─── PUT /api/config/plan ────────────────────────────────────────────────────
app.put('/api/config/plan', requireHQAuth, async (req, res) => {
  const { key } = req.body as { key: string };
  if (!CLAUDE_PLANS[key]) return res.status(400).json({ error: 'Unknown plan key' });
  if (!TRENDS_DB_URL) return res.status(501).json({ error: 'TRENDS_DB_URL not configured' });
  let client: pg.Client | null = null;
  try {
    client = await getTrendsConnection();
    await client.query(
      `INSERT INTO user_config (key, value, updated_at) VALUES ('plan_key', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
      [key]
    );
    res.json({ ok: true, plan: { key, ...CLAUDE_PLANS[key], detected: false } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  } finally {
    if (client) await client.end().catch(() => {});
  }
});

// ─── GET /api/trends ─────────────────────────────────────────────────────────
app.get('/api/trends', requireHQAuth, async (req, res) => {
  if (!TRENDS_DB_URL) { res.json({ daily: [], totals: { costUsd: 0, tokensIn: 0, tokensOut: 0, jobsCompleted: 0, jobsFailed: 0 }, plan: { key: 'api', ...CLAUDE_PLANS.api, detected: true, planCostForPeriod: 0, savings: 0 } }); return; }
  const days = Math.min(Math.max(parseInt((req.query.days as string) ?? '7', 10), 1), 90);
  let client: pg.Client | null = null;
  try {
    client = await getTrendsConnection();
    const result = await client.query(`
      SELECT date::text, tokens_in, tokens_out, cost_usd, jobs_completed, jobs_failed, sessions
      FROM daily_stats WHERE date >= CURRENT_DATE - INTERVAL '${days} days' ORDER BY date ASC
    `);
    const daily = result.rows.map((row) => ({
      date: row.date,
      tokensIn: parseInt(row.tokens_in, 10),
      tokensOut: parseInt(row.tokens_out, 10),
      costUsd: parseFloat(row.cost_usd),
      jobsCompleted: parseInt(row.jobs_completed, 10),
      jobsFailed: parseInt(row.jobs_failed, 10),
      sessions: parseInt(row.sessions, 10),
    }));
    const totals = {
      costUsd: Math.round(daily.reduce((s, d) => s + d.costUsd, 0) * 10000) / 10000,
      tokensIn: daily.reduce((s, d) => s + d.tokensIn, 0),
      tokensOut: daily.reduce((s, d) => s + d.tokensOut, 0),
      jobsCompleted: daily.reduce((s, d) => s + d.jobsCompleted, 0),
      jobsFailed: daily.reduce((s, d) => s + d.jobsFailed, 0),
    };
    const plan = await getOrDetectPlan(client);
    const planCostForPeriod = Math.round((plan.monthlyUsd / 30) * days * 100) / 100;
    const savings = Math.round((totals.costUsd - planCostForPeriod) * 100) / 100;
    res.json({ daily, totals, plan: { key: plan.key, name: plan.name, monthlyUsd: plan.monthlyUsd, detected: plan.detected, planCostForPeriod, savings } });
  } catch (err) {
    console.error('[trends]', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch trends' });
  } finally {
    if (client) await client.end().catch(() => {});
  }
});

// ─── SSE /api/events/hq ──────────────────────────────────────────────────────
let prevSessionCount = 0;

app.get('/api/events/hq', requireHQAuth, (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  addHQClient(res);
  console.log(`[sse:hq] new connection (total: ${getHQClientCount()})`);

  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`);

  // Replay recent events from log
  for (const e of loadRecentHQEvents()) {
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  }

  // Emit current active session state
  const initCount = getActiveSessionCount();
  for (let i = 1; i <= initCount; i++) {
    const agentId = i === 1 ? 'jarvis' : `jarvis-${i}`;
    res.write(`data: ${JSON.stringify({ type: 'agent:start', agent: agentId, jobId: `cc-session-${i}`, text: i === 1 ? getSessionSummary() : 'Claude Code session active', epoch: Date.now() })}\n\n`);
  }

  const statsInterval = setInterval(async () => {
    try {
      const { tokens, cost } = await scanTodayTokens();
      const { diskUsed: du, diskTotal: dt } = getDiskStats();
      const sessionCount = getActiveSessionCount();
      broadcastHQEvent({
        type: 'stats',
        sessions: getHQClientCount(),
        bullActive: sessionCount,
        bullWaiting: 0,
        cpu: Math.round(os.loadavg()[0] * 100) / 100,
        mem: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        memTotal: Math.round(os.totalmem() / 1024 / 1024),
        diskUsed: Math.round(du / 1024 / 1024),
        diskTotal: Math.round(dt / 1024 / 1024),
        tokensToday: tokens,
        costToday: cost,
        jarvisSessions: sessionCount,
      });

      recordDailyStats().catch(err => console.error('[trends-update]', (err as Error).message));

      // Detect session start/stop transitions
      for (let i = prevSessionCount + 1; i <= sessionCount; i++) {
        const agentId = i === 1 ? 'jarvis' : `jarvis-${i}`;
        const e = { type: 'agent:start' as const, agent: agentId, jobId: `cc-session-${i}`, text: i === 1 ? getSessionSummary() : 'Claude Code session active' };
        appendHQEventLog(e as Record<string, unknown>);
        broadcastHQEvent(e);
      }
      for (let i = sessionCount + 1; i <= prevSessionCount; i++) {
        const agentId = i === 1 ? 'jarvis' : `jarvis-${i}`;
        const e = { type: 'agent:complete' as const, agent: agentId, jobId: `cc-session-${i}`, durationMs: 0 };
        appendHQEventLog(e as Record<string, unknown>);
        broadcastHQEvent(e);
      }
      prevSessionCount = sessionCount;
    } catch { /* ignore */ }
  }, 1000);

  const heartbeatInterval = setInterval(() => {
    broadcastHQEvent({ type: 'heartbeat' });
  }, 30000);

  res.on('close', () => {
    removeHQClient(res);
    clearInterval(statsInterval);
    clearInterval(heartbeatInterval);
    console.log(`[sse:hq] connection closed (total: ${getHQClientCount()})`);
  });
});

// ─── GET /api/jobs/:jobId ─────────────────────────────────────────────────────
// Stub — extend this to look up jobs from your own queue system (e.g. BullMQ)
app.get('/api/jobs/:jobId', requireHQAuth, (req, res) => {
  const jobId = req.params['jobId'] as string;
  if (jobId.startsWith('cc-session')) {
    res.json({ id: jobId, agent: 'jarvis', state: getActiveSessionCount() > 0 ? 'active' : 'done', text: getSessionSummary() });
    return;
  }
  res.status(404).json({ error: 'Job not found — extend /api/jobs/:jobId to query your queue' });
});

// ─── Serve HQ frontend ────────────────────────────────────────────────────────
const hqDistDir = path.join(__dirname, '..', 'dist', 'public', 'hq');
app.use('/hq', express.static(hqDistDir));
app.get('/hq/*', (_req, res) => {
  res.sendFile(path.join(hqDistDir, 'index.html'));
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`[server] Agent HQ running on http://0.0.0.0:${SERVER_PORT}`);
  console.log(`[server] Dashboard: http://localhost:${SERVER_PORT}/hq`);
});

process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM — shutting down');
  process.exit(0);
});
