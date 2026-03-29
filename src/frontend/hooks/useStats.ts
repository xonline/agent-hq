import { useState, useCallback } from 'react';
import type { SystemStats } from '../types/hq.js';
import type { HQEvent } from '../types/hq.js';

export function useStats() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  const handleEvent = useCallback((event: HQEvent) => {
    if (event.type === 'stats') {
      const { type: _, ...rest } = event;
      setStats(rest);
    }
  }, []);

  return { stats, handleEvent };
}
