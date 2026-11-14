export function sortedCopy<T>(items: Iterable<T>, compare: (a: T, b: T) => number): T[] {
  const copy = [...items];
  copy.sort(compare);
  return copy;
}
