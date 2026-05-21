import { GenericDebouncer } from "@vortex/shared";

export default class Debouncer extends GenericDebouncer<
  NodeJS.Timeout,
  typeof setTimeout,
  typeof clearTimeout
> {
  constructor(
    func: (...args: unknown[]) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    super(setTimeout, clearTimeout, func, debounceMS, reset, triggerImmediately);
  }
}
