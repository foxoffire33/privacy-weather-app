export function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso  }T12:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b  }T12:00Z`).getTime() - new Date(`${a  }T12:00Z`).getTime()) / 86_400_000);
