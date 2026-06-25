import { GenericDebouncer } from "@vortex/shared";

export default class Debouncer<Args extends unknown[] = unknown[]> extends GenericDebouncer<
  NodeJS.Timeout,
  typeof setTimeout,
  typeof clearTimeout,
  Args
> {
  constructor(
    func: (...args: Args) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    super(setTimeout, clearTimeout, func, debounceMS, reset, triggerImmediately);
  }
}
