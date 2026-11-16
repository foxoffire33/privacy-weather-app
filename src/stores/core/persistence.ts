let asked = false;

export async function requestPersistentStorage(): Promise<boolean> {
  if (asked || typeof navigator === 'undefined' || !('storage' in navigator)) { return false; }
  asked = true;
  if (await navigator.storage.persisted()) { return true; }
  return navigator.storage.persist();
}
