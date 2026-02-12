import {
  GenericDebouncer,
  SetTimeoutFunc,
  ClearTimeoutFunc,
} from "../shared/Debouncer";

export default class Debouncer extends GenericDebouncer<
  ReturnType<typeof setTimeout>,
  SetTimeoutFunc<ReturnType<typeof setTimeout>>,
  ClearTimeoutFunc<ReturnType<typeof setTimeout>>
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
