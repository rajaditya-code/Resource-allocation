'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export function useFetch(url, options = {}) {
  const { immediate = true, params = {}, deps = [] } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = useCallback(async (overrideParams = {}) => {
    try {
      setLoading(true);
      setError(null);

      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const { data: responseData } = await api.get(url, {
        params: { ...params, ...overrideParams },
        signal: abortRef.current.signal,
      });

      setData(responseData);
      return responseData;
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError(err.response?.data?.detail || err.message || 'Failed to fetch data');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [url, JSON.stringify(params)]);

  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [url, immediate, ...deps]);

  const refetch = useCallback((overrideParams) => fetchData(overrideParams), [fetchData]);

  const mutate = useCallback((newData) => {
    setData(typeof newData === 'function' ? newData(data) : newData);
  }, [data]);

  return { data, loading, error, refetch, mutate };
}

export default useFetch;
