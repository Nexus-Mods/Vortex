import { sum } from '../../util/util';

interface ISpeedEntry {
  lastMeasure: number;
  timeSlices: number[];
}

/**
 * calculates a moving average of the download speed (total and
 * per counter)
 *
 * @class SpeedCalculator
 */
class SpeedCalculator {
  private mCounters: { [ id: number ]: ISpeedEntry } = {};
  private mTimeSlices: number[] = [];
  private mHorizon: number;
  private mMeasureTime: number;
  private mTargetRate: number = 0;

  constructor(horizon: number, speedCB: (speed: number) => void) {
    this.mHorizon = horizon;
    this.mMeasureTime = this.now();
    setInterval(() => {
      this.moveHorizon();
      const totalRate = sum(this.mTimeSlices.slice(0, this.mHorizon - 1)) / (this.mHorizon - 1);
      this.mTargetRate = this.mTargetRate * 0.99 + totalRate * 0.01;
      speedCB(totalRate);
    }, 1000);
  }

  public initCounter(id: number) {
    this.mCounters[id] = { lastMeasure: this.now(), timeSlices: [] };
  }

  public addMeasure(id: number, count: number): boolean {
    const now: number = this.now();

    if (this.mCounters[id] === undefined) {
      // counter already stopped
      return;
    }

    const secondsPassed = now - this.mCounters[id].lastMeasure;
    const perSec = count / (secondsPassed + 1);
    for (let i = this.mHorizon - secondsPassed - 1; i < this.mHorizon; ++i) {
      if (this.mTimeSlices[i] === undefined) {
        this.mTimeSlices[i] = 0;
      }
      if (this.mCounters[id].timeSlices[i] === undefined) {
        this.mCounters[id].timeSlices[i] = 0;
      }
      this.mTimeSlices[i] += perSec;
      this.mCounters[id].timeSlices[i] += perSec;
    }
    let starvation;
    if ((secondsPassed > 0)
        && (this.mCounters[id].timeSlices.length === this.mHorizon)) {
      const rate =
        sum(this.mCounters[id].timeSlices.slice(0, this.mHorizon - 1)) / (this.mHorizon - 1);
      starvation = rate < ((this.mTargetRate / Object.keys(this.mCounters).length) / 5);
    }

    this.mCounters[id].lastMeasure = now;
    return starvation;
  }

  public stopCounter(id: number) {
    delete this.mCounters[id];
  }

  private moveHorizon() {
    const time = this.now();
    if (this.mTimeSlices.length > 0) {
      for (let i = 0; i < time - this.mMeasureTime; ++i) {
        this.mTimeSlices.shift();
        Object.keys(this.mCounters)
            .forEach(
                counterId => { this.mCounters[counterId].timeSlices.shift(); });
      }
    }
    this.mMeasureTime = time;
  }

  private now(): number {
    return Math.floor(Date.now() / 1000);
  }
}

export default SpeedCalculator;
