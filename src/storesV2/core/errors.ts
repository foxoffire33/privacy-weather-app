export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e !== '') return e;
  return 'Request failed';
}

export function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}
