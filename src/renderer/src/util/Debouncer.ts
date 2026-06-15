import { GenericDebouncer } from "@vortex/shared";

export default class Debouncer<Args extends unknown[] = unknown[]> extends GenericDebouncer<
  number,
  typeof window.setTimeout,
  typeof window.clearTimeout,
  Args
> {
  constructor(
    func: (...args: Args) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    const boundSetTimeout = window.setTimeout.bind(window);
    const boundClearTimeout = window.clearTimeout.bind(window);

    super(boundSetTimeout, boundClearTimeout, func, debounceMS, reset, triggerImmediately);
  }
}
