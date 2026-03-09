import { unknownToError } from "./errors";

type Callback = (err: Error | null) => void;

export type SetTimeoutFunc<Timeout> = (
  callback: () => void,
  delay: number,
) => Timeout;
export type ClearTimeoutFunc<Timeout> = (timeout: Timeout) => void;

/**
 * management function. Prevents a function from being called too often
 * and, for function returning a promise, it ensures that it's not run
 * again (through this Debouncer) before the promise is resolved.
 */
export class GenericDebouncer<
  Timeout,
  SetTimeout extends SetTimeoutFunc<Timeout>,
  ClearTimeout extends ClearTimeoutFunc<Timeout>,
> {
  private mDebounceMS: number;
  private mFunc: (...args: any[]) => Error | PromiseLike<void>;
  private mTimer: Timeout | undefined;

  private mCallbacks: Callback[] = [];
  private mAddCallbacks: Callback[] = [];
  private mRunning: boolean = false;
  private mReschedule: "no" | "yes" | "immediately" = "no";
  private mArgs: any[] = [];
  private mResetting: boolean;
  private mTriggerImmediately: boolean;
  // only used with triggerImmediately
  private mRetrigger: boolean = false;

  readonly #setTimeoutFunc: SetTimeout;
  readonly #clearTimeoutFunc: ClearTimeout;

  /**
   * constructor
   * @param func the function to call when the timer expired
   * @param debounceMS the (minimum) time between two calls
   * @param reset if true (the default) the time is reset with every
   *              time schedule gets called. This means if the debouncer
   *              is triggered regularly in less than debounceMS it never
   *              gets run.
   * @param triggerImmediately if true, the debouncer will trigger immediately
   *                           when first called and then not be called again
   *                           until the timer expires. Otherwise (the default)
   *                           the initial call is delay.
   */
  constructor(
    setTimeoutFunc: SetTimeout,
    clearTimeoutFunc: ClearTimeout,
    func: (...args: any[]) => Error | PromiseLike<void>,
    debounceMS: number,
    reset?: boolean,
    triggerImmediately: boolean = false,
  ) {
    this.#setTimeoutFunc = setTimeoutFunc;
    this.#clearTimeoutFunc = clearTimeoutFunc;

    this.mResetting = reset !== false;
    this.mFunc = func;
    this.mDebounceMS = debounceMS;
    this.mTriggerImmediately = triggerImmediately;
  }

  /**
   * schedule the function and invoke the callback once that is done
   * @param callback the callback to invoke upon completion
   * @param args the arguments to pass to the function. When the timer expires
   *             and the function actually gets invoked, only the last set of
   *             parameters will be used
   */
  public schedule(callback?: (err: Error) => void, ...args: any[]): void {
    if (callback !== undefined && callback !== null) {
      this.mCallbacks.push(callback);
    }
    this.mArgs = args;
    if (this.mTriggerImmediately && this.mTimer === undefined) {
      this.run();
    } else {
      const doReset = this.mTimer !== undefined && this.mResetting;
      if (doReset) {
        this.clear();
      }

      if (this.mTriggerImmediately) {
        this.mRetrigger = true;
        if (doReset) {
          this.startTimer();
        }
      } else if (this.mRunning) {
        if (this.mReschedule !== "immediately") {
          this.mReschedule = "yes";
        }
      } else if (this.mTimer === undefined) {
        this.startTimer();
      }
    }
  }

  /**
   * run the function immediately without waiting for the timer
   * to run out. (It does cancel the timer though and invokes all
   * scheduled callbacks)
   *
   * @param {(err: Error) => void} callback
   * @param {...any[]} args
   *
   * @memberOf Debouncer
   */
  public runNow(callback: (err: Error) => void, ...args: any[]): void {
    if (this.mTimer !== undefined) {
      this.clear();
    }

    if (callback !== undefined && callback !== null) {
      this.mCallbacks.push(callback);
    }

    this.mArgs = args;

    if (this.mRunning) {
      this.mReschedule = "immediately";
    } else {
      this.run();
    }
  }

  /**
   * wait for the completion of the current timer without scheduling it.
   * if the function is not scheduled currently the callback will be
   * called (as a success) immediately.
   * This does not reset the timer
   *
   * @param {(err: Error) => void} callback
   * @param {boolean} immediately if set (default is false) the function gets called
   *                              immediately instead of awaiting the timer
   *
   * @memberOf Debouncer
   */
  public wait(
    callback: (err: Error | null) => void,
    immediately: boolean = false,
  ): void {
    if (this.mTimer === undefined && !this.mRunning) {
      // not scheduled
      callback(null);
      return;
    }

    this.mAddCallbacks.push(callback);

    if (immediately && !this.mRunning) {
      this.clear();

      this.run();
    }
  }

  public clear(): void {
    this.#clearTimeoutFunc(this.mTimer);
    this.mTimer = undefined;
  }

  private run() {
    const callbacks = this.mCallbacks;
    this.mCallbacks = [];
    const args = this.mArgs;
    this.mArgs = [];
    this.mTimer = undefined;

    let prom: Error | PromiseLike<void>;
    try {
      prom = this.mFunc(...args);
    } catch (err) {
      prom = unknownToError(err);
    }

    if (prom?.["then"] !== undefined) {
      this.mRunning = true;
      prom["then"](() => this.invokeCallbacks(callbacks, null))
        .catch((err: Error) => this.invokeCallbacks(callbacks, err))
        .finally(() => {
          this.mRunning = false;
          if (this.mReschedule === "immediately") {
            this.mReschedule = "no";
            this.run();
          } else if (this.mReschedule === "yes") {
            this.mReschedule = "no";
            this.reschedule();
          }
        });
    } else {
      this.invokeCallbacks(callbacks, prom as Error);
    }

    // in the default case the "run" marks the end of the timer,
    // in the "trigger immediately" case it marks the start
    if (this.mTriggerImmediately) {
      this.startTimer();
    }
  }

  private reschedule() {
    if (this.mTimer !== undefined && this.mResetting) {
      this.clear();
    }

    if (this.mTimer === undefined) {
      this.startTimer();
    }
  }

  private invokeCallbacks(localCallbacks: Callback[], err: Error | null) {
    localCallbacks.forEach((cb) => cb(err));
    this.mAddCallbacks.forEach((cb) => cb(err));
    this.mAddCallbacks = [];
  }

  private startTimer() {
    this.mTimer = this.#setTimeoutFunc(() => {
      this.mTimer = undefined;
      if (!this.mTriggerImmediately || this.mRetrigger) {
        this.mRetrigger = false;
        if (this.mRunning) {
          this.mReschedule = "immediately";
        } else {
          this.run();
        }
      }
    }, this.mDebounceMS);
  }
}
