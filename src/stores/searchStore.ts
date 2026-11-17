import { create } from 'zustand';

import { searchCities } from './api/openMeteo';
import { classify } from './core/appError';
import { isAbort } from './core/errors';
import { initialQueryState } from './core/types';
import { begin, settleError, succeed } from './factory/queryState';

import type { SearchState } from './storeTypes';

const MIN_TERM = 2;

let controller: AbortController | null = null;

export const useSearchStore = create<SearchState>()((set) => ({
  query: '',
  results: [],
  request: initialQueryState(),
  setQuery: (query) => { set({ query }); },
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
    } catch (error) {
      if (isAbort(error)) { return; }
      const appError = classify(error, 'search');
      set((s) => ({ request: settleError(s.request, appError) }));
    }
  },
}));
