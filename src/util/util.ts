export function countIf<T>(container: T[], predicate: (value: T) => boolean): number {
  return container.reduce((count: number, value: T): number => {
    return count + (predicate(value) ? 1 : 0);
  }, 0);
}

export function sum(container: number[]): number {
  return container.reduce((total: number, value: number): number => {
    return total + value;
  }, 0);
}
