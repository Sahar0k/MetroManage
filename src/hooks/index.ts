import { useState, useCallback, useEffect } from 'react';

export function useModal<T = any>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const open = useCallback((data?: T) => { setData(data || null); setIsOpen(true); }, []);
  const close = useCallback(() => { setData(null); setIsOpen(false); }, []);
  return { isOpen, data, open, close };
}

export function useLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback(async <T,>(asyncFn: () => Promise<T>) => {
    setIsLoading(true); setError(null);
    try { const result = await asyncFn(); return result; }
    catch (err) { const error = err instanceof Error ? err : new Error('Unknown error'); setError(error.message); throw error; }
    finally { setIsLoading(false); }
  }, []);
  return { isLoading, error, execute };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}
