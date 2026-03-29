import { useState, useCallback, useEffect, useMemo } from 'react';
import { useHQStream } from './hooks/useHQStream.js';
import { useAgents } from './hooks/useAgents.js';
import { useStats } from './hooks/useStats.js';
import { useTasks } from './hooks/useTasks.js';
import { TopBar } from './components/TopBar.js';
import { Sidebar } from './components/Sidebar.js';
import type { SidebarView } from './components/Sidebar.js';
import { OfficeScene } from './components/OfficeScene.js';
import { KanbanBoard } from './components/KanbanBoard.js';
import { LiveFeed } from './components/LiveFeed.js';
import { LiveStats } from './components/LiveStats.js';
import { LogsView } from './components/LogsView.js';
import { AgentsView } from './components/AgentsView.js';
import { TrendsView } from './components/TrendsView.js';
import { SettingsView } from './components/SettingsView.js';
import { PasswordModal } from './components/PasswordModal.js';
import { AGENT_ROSTER } from './types/hq.js';
import type { HQEvent, FeedEntry } from './types/hq.js';
import { checkAuth } from './lib/auth.js';
import './styles/app.css';
import './styles/sprites.css';

export function App() {
  const [filter, setFilter] = useState<'all' | 'csuite' | 'tony' | 'active' | 'jarvis'>(
    () => (localStorage.getItem('hq:filter') as 'all' | 'csuite' | 'tony' | 'active' | 'jarvis') || 'all'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('hq:theme') as 'dark' | 'light') || 'dark'
  );
  const [fontStep, setFontStep] = useState(
    () => parseInt(localStorage.getItem('hq:fontStep') || '0', 10)
  );
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [view, setView] = useState<SidebarView>(
    () => (localStorage.getItem('hq:view') as SidebarView) || 'office'
  );

  // Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [isProtected, setIsProtected] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth().then(({ protected: p, valid }) => {
      setIsProtected(p);
      setAuthRequired(p && !valid);
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, []);

  // Load historical events from PG on mount
  useEffect(() => {
    fetch('/api/hq-log?limit=200')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((rows: Array<{ event_id: string; type: string; agent: string; message: string; colour: string; ts: string; epoch: number }>) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const historical: FeedEntry[] = rows
          .filter(r => r.type === 'agent:start' || r.type === 'agent:complete' || r.type === 'agent:error')
          .map(r => ({
            id: r.event_id,
            ts: r.ts || new Date(r.epoch).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
            epoch: r.epoch,
            agent: (r.agent || 'sys').toLowerCase(),
            colour: r.colour || '#64748b',
            message: r.message || '',
          }));
        if (historical.length === 0) return;
        setFeed(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const fresh = historical.filter(e => !existingIds.has(e.id));
          return [...fresh, ...prev].slice(-200);
        });
      })
      .catch(() => { /* silent — file-based fallback still works */ });
  }, []);

  // Hooks that manage their own internal state
  const { agents, handleEvent: handleAgentEvent } = useAgents();
  const { stats, handleEvent: handleStatsEvent } = useStats();
  const board = useTasks();

  // Build colour map from AGENT_ROSTER (memoized since AGENT_ROSTER is immutable)
  const COLOUR_MAP = useMemo(
    () => Object.fromEntries(
      AGENT_ROSTER.map(a => [a.id, a.colour])
    ) as Record<string, string>,
    []
  );

  // Maximum entries to keep in the live feed
  const MAX_FEED_ENTRIES = 50;

  // Unified event handler that combines all handlers
  const handleEvent = useCallback((event: HQEvent) => {
    handleAgentEvent(event);
    handleStatsEvent(event);

    if (event.type === 'agent:start') {
      const agentId = event.agent.toLowerCase();
      const now = event.epoch ?? Date.now();
      const entry: FeedEntry = {
        id: `${agentId}:${event.jobId}:start`,
        ts: new Date(now).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        epoch: now,
        agent: agentId,
        colour: COLOUR_MAP[agentId] || '#64748b',
        message: event.text.substring(0, 80),
      };
      setFeed(prev => {
        if (prev.some(e => e.id === entry.id)) return prev; // dedup replays
        return [...prev.slice(-(MAX_FEED_ENTRIES - 1)), entry];
      });
    } else if (event.type === 'agent:complete') {
      const agentId = event.agent.toLowerCase();
      const now = event.epoch ?? Date.now();
      const entry: FeedEntry = {
        id: `${agentId}:${event.jobId}:complete`,
        ts: new Date(now).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        epoch: now,
        agent: agentId,
        colour: COLOUR_MAP[agentId] || '#64748b',
        message: `✓ complete (${Math.round(event.durationMs / 1000)}s)`,
      };
      setFeed(prev => {
        if (prev.some(e => e.id === entry.id)) return prev;
        return [...prev.slice(-(MAX_FEED_ENTRIES - 1)), entry];
      });
    } else if (event.type === 'agent:error') {
      const agentId = event.agent.toLowerCase();
      const now = event.epoch ?? Date.now();
      const entry: FeedEntry = {
        id: `${agentId}:${event.jobId}:error`,
        ts: new Date(now).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        epoch: now,
        agent: agentId,
        colour: COLOUR_MAP[agentId] || '#64748b',
        message: `✗ error: ${event.error}`,
      };
      setFeed(prev => {
        if (prev.some(e => e.id === entry.id)) return prev;
        return [...prev.slice(-(MAX_FEED_ENTRIES - 1)), entry];
      });
    }
  }, [COLOUR_MAP, handleAgentEvent, handleStatsEvent]);

  // Stream SSE events
  useHQStream(handleEvent);

  // Apply theme to document root + persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hq:theme', theme);
  }, [theme]);

  // Apply font size to document root via CSS variables + persist
  useEffect(() => {
    const base = 18 + fontStep;
    const r = document.documentElement.style;
    r.setProperty('--fs-base', `${base}px`);
    r.setProperty('--fs-sm',   `${base - 4}px`);
    r.setProperty('--fs-xs',   `${base - 6}px`);
    r.setProperty('--fs-lg',   `${base + 6}px`);
    localStorage.setItem('hq:fontStep', String(fontStep));
  }, [fontStep]);

  // Persist view and filter
  useEffect(() => { localStorage.setItem('hq:view', view); }, [view]);
  useEffect(() => { localStorage.setItem('hq:filter', filter); }, [filter]);

  const handleThemeToggle = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleFontInc   = useCallback(() => setFontStep(s => Math.min(s + 1, 10)), []);
  const handleFontDec   = useCallback(() => setFontStep(s => Math.max(s - 1, -7)), []);
  const handleFontReset = useCallback(() => setFontStep(0), []);

  const handleClearFeed = useCallback(() => {
    setFeed([]);
  }, []);

  const handleUnlocked = useCallback(() => {
    setAuthRequired(false);
    setIsProtected(true);
  }, []);

  const handlePasswordUpdate = useCallback((nowProtected: boolean) => {
    setIsProtected(nowProtected);
  }, []);

  if (!authChecked) return null;
  if (authRequired) return <PasswordModal onUnlocked={handleUnlocked} />;

  return (
    <div className="app-grid">
      <TopBar
        theme={theme}
        onThemeToggle={handleThemeToggle}
        fontStep={fontStep}
        onFontInc={handleFontInc}
        onFontDec={handleFontDec}
        onFontReset={handleFontReset}
      />
      <Sidebar view={view} onViewChange={setView} reviewCount={board.review.length} />
      <main className="main-area">
        {view === 'office' && (
          <>
            <OfficeScene agents={agents} filter={filter} onFilterChange={setFilter} jarvisSessions={stats?.jarvisSessions ?? 0} />
            <KanbanBoard board={board} />
          </>
        )}
        {view === 'tasks' && (
          <div className="view-tasks">
            <KanbanBoard board={board} />
          </div>
        )}
        {view === 'logs' && <LogsView entries={feed} />}
        {view === 'agents' && <AgentsView agents={agents} />}
        {view === 'trends' && <TrendsView />}
        {view === 'settings' && (
          <SettingsView
            theme={theme}
            onThemeToggle={handleThemeToggle}
            fontStep={fontStep}
            onFontInc={handleFontInc}
            onFontDec={handleFontDec}
            onFontReset={handleFontReset}
            onClearFeed={handleClearFeed}
            feedCount={feed.length}
            stats={stats}
            isProtected={isProtected}
            onPasswordUpdate={handlePasswordUpdate}
          />
        )}
      </main>
      <div className="right-col">
        <LiveFeed entries={feed} filter={filter} agents={Object.fromEntries(agents.map(a => [a.id, { state: a.state }]))} />
        <LiveStats stats={stats} entries={feed} />
      </div>
    </div>
  );
}
