import { create } from 'zustand';

import { searchCities } from './api/openMeteo';
import { errorMessage, isAbort } from './core/errors';
import { initialQueryState  } from './core/types';
import { begin, fail, succeed } from './factory/queryState';

import type {QueryState} from './core/types';
import type { SearchState } from './storeTypes';
import type { GeoResult } from './types';

export type { SearchState } from './storeTypes';

const MIN_TERM = 2;

let controller: AbortController | null = null;

export const useSearchStore = create<SearchState>()((set, get) => ({
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
      if (isAbort(error)) {return;}
      set((s) => ({ request: fail(s.request, errorMessage(error)) }));
    }
  },
}));
