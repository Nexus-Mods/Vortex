import {
  GenericDebouncer,
  SetTimeoutFunc,
  ClearTimeoutFunc,
} from "../shared/Debouncer";

export default class Debouncer extends GenericDebouncer<
  NodeJS.Timeout,
  SetTimeoutFunc<NodeJS.Timeout>,
  ClearTimeoutFunc<NodeJS.Timeout>
> {
  constructor(
    func: (...args: any[]) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    super(
      (callback, delay) => setTimeout(callback, delay),
      (timeout) => clearTimeout(timeout),
      func,
      debounceMS,
      reset,
      triggerImmediately,
    );
  }
}
