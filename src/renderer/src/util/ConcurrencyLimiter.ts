import { getErrorMessage, unknownToError } from "@vortex/shared";
import { delay } from "./util";

const RETRIES = 5;

/**
 * helper class to limit concurrency with asynchronous functions.
 */
class ConcurrencyLimiter {
  private mInitialLimit: number;
  private mLimit: number;
  private mNext: (() => any) | undefined;
  private mEndOfQueue: Promise<void>;
  private mRepeatTest: ((err: Error) => boolean) | undefined;

  /**
   * Constructor
   * @param limit number of operations enqueued with do() that will happen concurrently
   * @param repeatTest if set, this function is called when an error happens and it can
   *                   decide if the operation should be retried.
   *                   This is purely a convenience feature but usually if you want to limit
   *                   concurrency it's because you're worried that some resource will run out
   *                   and it's not usually possible to know in advance how many operations
   *                   exactly can happen in parallel so you will usually still want to
   *                   handle errors that indicate the resource running out separately
   */
  constructor(limit: number, repeatTest?: (err: Error) => boolean) {
    this.mLimit = this.mInitialLimit = limit;
    this.mEndOfQueue = Promise.resolve();
    this.mRepeatTest = repeatTest;
  }

  public clearQueue(): void {
    this.mEndOfQueue = Promise.resolve();
    this.mNext = undefined;
    this.mLimit = this.mInitialLimit;
  }

  public async do<T>(cb: () => PromiseLike<T>): Promise<T> {
    return this.doImpl(cb, RETRIES);
  }

  private async doImpl<T>(cb: () => PromiseLike<T>, tries: number): Promise<T> {
    if (this.mLimit <= 0) {
      return this.enqueue(cb, tries);
    }
    return this.process(cb, tries);
  }

  private async process<T>(
    cb: () => PromiseLike<T>,
    tries: number,
  ): Promise<T> {
    // reduce limit while processing
    --this.mLimit;
    try {
      // forward cb result
      return await cb();
    } catch (unknownError) {
      const err = unknownToError(unknownError);

      if (
        this.mRepeatTest !== undefined &&
        tries > 0 &&
        this.mRepeatTest(err)
      ) {
        return await delay(100).then(() => this.do(cb));
      } else {
        return Promise.reject(err);
      }
    } finally {
      // increment limit again
      ++this.mLimit;
      // if there is something in the queue, process it
      if (this.mNext !== undefined) {
        this.mNext();
      }
    }
  }

  private enqueue<T>(cb: () => PromiseLike<T>, tries: number): Promise<T> {
    return new Promise((outerResolve, outerReject) => {
      this.mEndOfQueue = this.mEndOfQueue.then(() =>
        new Promise<boolean>((resolve) => {
          // if the caller calls "do" in parallel, by the time we get here
          // tasks may already be fulfilled. More they might all have been fulfilled already
          // in which case no one is going to call mNext.
          if (this.mLimit > 0) {
            resolve(false);
          } else {
            // this pauses the queue until someone calls mNext
            this.mNext = () => resolve(true);
          }
        }).then((queued: boolean) => {
          // once the queue is ticked, reset mNext in case there
          // is nothing else queued, then process the actual promise
          if (queued) {
            this.mNext = undefined;
          }
          this.process(cb, tries)
            .then(outerResolve)
            .catch(outerReject)
            .then(() => null);
          // this resolves immediately, so the next promise in the queue
          // gets paused
          return Promise.resolve();
        }),
      );
    });
  }
}

export default ConcurrencyLimiter;
