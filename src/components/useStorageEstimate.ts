import { useEffect, useState } from 'react';

import { estimateStorage, onCacheCleared } from '../stores/core/persistence';

import type { StorageEstimate } from '../stores/core/persistence';

export function useStorageEstimate(): StorageEstimate | null {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async (): Promise<void> => {
      const next = await estimateStorage();
      if (active) { setEstimate(next); }
    };
    void refresh();
    const unsubscribe = onCacheCleared(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);
  return estimate;
}
