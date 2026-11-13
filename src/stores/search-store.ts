import { create } from 'zustand';
import { errorMessage, isAbort } from './core/errors';
import { initialQueryState, type QueryState } from './core/types';
import { begin, fail, succeed } from './factory/query-state';
import { searchCities } from './api/open-meteo';
import type { GeoResult } from './types';
import type { SearchState } from './store-types';

export type { SearchState } from './store-types';

const MIN_TERM = 2;

let controller: AbortController | null = null;

export const useSearchStore = create<SearchState>()((set, get) => ({
  query: '',
  results: [],
  request: initialQueryState(),
  setQuery: (query) => set({ query }),
  run: async (q) => {
    controller?.abort();
    const term = q.trim();
    if (term.length < MIN_TERM) {
      set({ results: [], request: initialQueryState() });
      return;
    }
    controller = new AbortController();
    set((s) => ({ request: begin(s.request) }));
    try {
      const results = await searchCities(term, controller.signal);
      set({ results, request: succeed() });
    } catch (e) {
      if (isAbort(e)) return;
      set((s) => ({ request: fail(s.request, errorMessage(e)) }));
    }
  },
}));
