import * as Promise from 'bluebird';

type Callback = (err: Error) => void;

/**
 * management function. Prevents a function from being called to often
 * and, for function returning a promise it ensures that it's not run
 * again (through this Debouncer) before the promise is resolved.
 * 
 * @class Debouncer
 */
class Debouncer {
  private mDebounceMS: number;
  private mFunc: () => Error | Promise<void>;
  private mTimer: NodeJS.Timer;

  private mCallbacks: Callback[] = [];
  private mRunning: boolean = false;
  private mReschedule: 'no' | 'yes' | 'immediately' = 'no';

  constructor(func: () => Error | Promise<void>, debounceMS: number) {
    this.mFunc = func;
    this.mDebounceMS = debounceMS;
  }

  public schedule(callback?: (err: Error) => void) {
    if (this.mTimer !== undefined) {
      clearTimeout(this.mTimer);
    }

    if (callback !== undefined) {
      this.mCallbacks.push(callback);
    }

    if (this.mRunning) {
      if (this.mReschedule !== 'immediately') {
        this.mReschedule = 'yes';
      }
    } else {
      this.startTimer();
    }
  }

  public runNow(callback?: (err: Error) => void) {
    if (this.mTimer !== undefined) {
      clearTimeout(this.mTimer);
    }

    if (callback !== undefined) {
      this.mCallbacks.push(callback);
    }

    if (this.mRunning) {
      this.mReschedule = 'immediately';
    } else {
      this.run();
    }
  }

  public clear() {
    clearTimeout(this.mTimer);
    this.mTimer = undefined;
  }

  private run() {
    this.mRunning = true;
    let callbacks = this.mCallbacks;
    this.mCallbacks = [];
    this.mTimer = undefined;

    let prom: Error | Promise<void> = this.mFunc();
    if (prom instanceof Promise) {
      prom.then(() => { callbacks.forEach((cb) => cb(null)); })
          .catch((err: Error) => { callbacks.forEach((cb) => cb(err)); })
          .finally(() => {
            this.mRunning = false;
            if (this.mReschedule === 'immediately') {
              this.mReschedule = 'no';
              this.run();
            } else if (this.mReschedule === 'yes') {
              this.mReschedule = 'no';
              this.schedule();
            }
          });
    } else {
      this.mRunning = false;
      callbacks.forEach((cb) => cb(prom as Error));
    }
  }

  private startTimer() {
    this.mTimer = setTimeout(() => this.run(), this.mDebounceMS);
  }
}

export default Debouncer;
