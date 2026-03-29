import { useEffect, useRef } from 'react';
import type { HQEvent } from '../types/hq.js';
import { sseUrl } from '../lib/auth.js';

export function useHQStream(onEvent: (event: HQEvent) => void) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(sseUrl('/api/events/hq'));
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as HQEvent;
          cbRef.current(event);
        } catch { /* ignore bad JSON */ }
      };
      es.onerror = () => {
        es?.close();
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, []);
}
