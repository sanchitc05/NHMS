import { useState, useEffect, useRef } from 'react';

interface Suggestion {
  display_name: string;
  lat: number;
  lon: number;
  type: string;
}

import { API_URL } from '@/lib/api-config';

export function useAutocomplete(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Clear previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!enabled || !query || query.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce 350ms
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `${API_URL}/geocode/autocomplete?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Autocomplete error:', e);
          setSuggestions([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, enabled]);

  return { suggestions, isLoading, clearSuggestions: () => setSuggestions([]) };
}
