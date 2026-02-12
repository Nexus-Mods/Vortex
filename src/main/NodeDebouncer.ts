import { GenericDebouncer } from "../shared/Debouncer";

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
    super(
      setTimeout,
      clearTimeout,
      func,
      debounceMS,
      reset,
      triggerImmediately,
    );
  }
}
