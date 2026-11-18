import { describe, expect, it } from 'vitest';

import { noteStorageFault, useBootStore } from '../bootStore';
import { StorageError } from '../core/idb';

describe('storage warning state', () => {
  it('keeps the original failure and reveals a later quota exhaustion', () => {
    useBootStore.setState({ storageError: null, storageQuotaExceeded: false });
    noteStorageFault(new StorageError('transaction-aborted', 'aborted'));
    const first = useBootStore.getState().storageError;
    noteStorageFault(new StorageError('quota-exceeded', 'full'));
    expect(useBootStore.getState().storageError).toBe(first);
    expect(useBootStore.getState().storageQuotaExceeded).toBe(true);
  });
});
