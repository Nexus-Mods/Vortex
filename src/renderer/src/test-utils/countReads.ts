/**
 * `target`, counting every read of its keys and values into `reads`. For performance tests that
 * cannot fail on behaviour: assert how often each input is read, so that work repeated per item
 * shows up as a count that grows with the number of items.
 */
export function countReads<T extends object>(target: T, reads: { count: number }): T {
  const counted =
    <A extends unknown[], R>(trap: (...args: A) => R) =>
    (...args: A): R => {
      reads.count++;
      return trap(...args);
    };
  return new Proxy<T>(target, {
    get: counted(Reflect.get),
    has: counted(Reflect.has),
    ownKeys: counted(Reflect.ownKeys),
    getOwnPropertyDescriptor: counted(Reflect.getOwnPropertyDescriptor),
  });
}
