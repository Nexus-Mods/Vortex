/**
 * tracks progress. This has been designed to handle subtasks
 *
 * @class Progress
 */
class Progress {

  private mMagnitude: number;
  private mStepCount: number;
  private mStepsCompleted: number;
  private mBaseValue: number;
  private mCallback: (percent: number, label: string) => void;
  private mDepth: number;
  private mIdx: number;

  constructor(baseValue: number, magnitude: number,
              callback: (percent: number, label: string) => void, depth: number = 0) {
    this.mMagnitude = magnitude;
    this.mBaseValue = baseValue;
    this.mCallback = callback;
    this.mStepsCompleted = 0;
    this.mDepth = depth;
  }

  /**
   * set the number of steps the progress bar has (that is: the number of
   * times 'completed' will be called before this progress is finished)
   *
   * @param {number} count
   *
   * @memberOf Progress
   */
  public setStepCount(count: number) {
    this.mStepCount = count > 0 ? count : 1;
  }

  /**
   * called whenever one step of the task is finished. label
   * should be a text giving the user a hint of what's currently going on
   * but please do not rely on this text being readable, depending on the theme
   * it may not be as long as the progress is very low
   *
   * @param {string} label
   *
   * @memberOf Progress
   */
  public completed(label: string): void {
    this.mStepsCompleted += 1;
    this.mCallback(this.currentProgress(), label);
  }

  /**
   * create a new progress bar that covers only the width of the current step
   * within this Progress.
   *
   * @returns
   *
   * @memberOf Progress
   */
  public derive(): Progress {
    const childMag = this.mMagnitude / this.mStepCount;
    return childMag > 0.9
      ? new Progress(this.currentProgress(),
                     childMag, this.mCallback, this.mDepth + 1)
      : null;
  }

  private currentProgress() {
    return this.mBaseValue + (this.mMagnitude * this.mStepsCompleted) / this.mStepCount;
  }
}

export default Progress;
