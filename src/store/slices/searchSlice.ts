import { searchCities } from '../../api/openMeteo';
import type { SearchSlice, SliceCreator } from '../types';

let controller: AbortController | null = null;

export const createSearchSlice: SliceCreator<SearchSlice> = (set, get) => ({
  query: '',
  results: [],
  searching: false,
  searchError: null,

  setQuery: (query) => set({ query }),

  runSearch: async (q) => {
    controller?.abort();
    const term = q.trim();
    if (term.length < 2) {
      set({ results: [], searching: false, searchError: null });
      return;
    }
    controller = new AbortController();
    set({ searching: true, searchError: null });
    try {
      const results = await searchCities(term, get().settings, controller.signal);
      set({ results, searching: false });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      set({ searching: false, searchError: (e as Error).message });
    }
  },
});
