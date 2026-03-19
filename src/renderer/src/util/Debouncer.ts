import { GenericDebouncer } from "@vortex/shared";

export default class Debouncer extends GenericDebouncer<
  number,
  typeof window.setTimeout,
  typeof window.clearTimeout
> {
  constructor(
    func: (...args: any[]) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    const boundSetTimeout = window.setTimeout.bind(window);
    const boundClearTimeout = window.clearTimeout.bind(window);

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
