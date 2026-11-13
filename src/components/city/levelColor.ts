export function levelColor(level: number | null | undefined): string {
  if (level === null || level === undefined) {return 'var(--mantine-color-dark-3)';}
  if (level <= 1) {return 'var(--mantine-color-dark-1)';}
  if (level <= 2) {return 'var(--mantine-color-signal-2)';}
  if (level <= 3) {return 'var(--mantine-color-signal-4)';}
  return 'var(--mantine-color-signal-5)';
}
