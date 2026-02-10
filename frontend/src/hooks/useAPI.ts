import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface UseAPIResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAPI<T = any>(endpoint: string, options?: {
  interval?: number;
  enabled?: boolean;
}): UseAPIResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}${endpoint}`);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error(`Error fetching ${endpoint}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.enabled === false) return;

    fetchData();

    // Set up polling if interval is specified
    if (options?.interval) {
      const intervalId = setInterval(fetchData, options.interval);
      return () => clearInterval(intervalId);
    }
  }, [endpoint, options?.interval, options?.enabled]);

  return { data, loading, error, refetch: fetchData };
}
