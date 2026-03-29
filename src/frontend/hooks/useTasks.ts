import { useState, useEffect } from 'react';
import type { KanbanBoard } from '../types/hq.js';
import { authHeaders } from '../lib/auth.js';

const EMPTY: KanbanBoard = { backlog: [], inProgress: [], review: [], done: [] };

export function useTasks() {
  const [board, setBoard] = useState<KanbanBoard>(EMPTY);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/tasks', { headers: authHeaders() });
        if (r.ok) setBoard(await r.json());
      } catch { /* ignore */ }
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  return board;
}
