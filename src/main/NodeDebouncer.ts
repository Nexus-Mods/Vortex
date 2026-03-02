import { GenericDebouncer } from "@vortex/shared";

export default class Debouncer extends GenericDebouncer<
  NodeJS.Timeout,
  typeof setTimeout,
  typeof clearTimeout
> {
  constructor(
    func: (...args: any[]) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    const boundSetTimeout = setTimeout.bind(globalThis);
    const boundClearTimeout = clearTimeout.bind(globalThis);

    super(
      boundSetTimeout,
      boundClearTimeout,
      func,
      debounceMS,
      reset,
      triggerImmediately,
    );
  }
}
