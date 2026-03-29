import { useState, useEffect } from 'react';
import { authHeaders } from '../lib/auth.js';

export interface TrendsDayData {
  date: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  jobsCompleted: number;
  jobsFailed: number;
  sessions: number;
}

export interface TrendsPlanInfo {
  key: string;
  name: string;
  monthlyUsd: number;
  detected: boolean;
  planCostForPeriod: number;
  savings: number;
}

export interface TrendsData {
  daily: TrendsDayData[];
  totals: {
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    jobsCompleted: number;
    jobsFailed: number;
  };
  plan?: TrendsPlanInfo;
}

interface UseTrendsReturn {
  data: TrendsData | null;
  loading: boolean;
  error: string | null;
}

export function useTrends(days: 7 | 30 | 60 | 90): UseTrendsReturn {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        const headers = await authHeaders();
        const response = await fetch(`/api/trends?days=${days}`, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
    const interval = setInterval(fetchTrends, 60000);
    return () => clearInterval(interval);
  }, [days]);

  return { data, loading, error };
}
