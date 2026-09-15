import { useState, useEffect, useRef } from 'react';
import { searchByQuery, GosreestrHint } from '../services/gosreestrService';

interface UseGosreestrSearchResult {
  hints: GosreestrHint[];
  loading: boolean;
  error: string | null;
}

export function useGosreestrSearch(query: string): UseGosreestrSearchResult {
  const [hints, setHints] = useState<GosreestrHint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Отмена предыдущего запроса
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Очистка предыдущего таймера
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Минимум 3 символа
    if (!query || query.length < 3) {
      setHints([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Debounce 400ms
    debounceTimerRef.current = setTimeout(async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const results = await searchByQuery(query, abortController.signal);
        
        if (!abortController.signal.aborted) {
          setHints(results);
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Запрос был отменён, игнорируем
          return;
        }
        
        if (!abortController.signal.aborted) {
          setError('Ошибка поиска в Госреестре');
          setHints([]);
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  return { hints, loading, error };
}
