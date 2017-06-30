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

  constructor(horizon: number, speedCB: (speed: number) => void) {
    this.mHorizon = horizon;
    this.mMeasureTime = this.now();
    setInterval(() => {
      this.moveHorizon();
      speedCB(sum(this.mTimeSlices) / this.mHorizon);
    }, 1000);
  }

  public initCounter(id: number) {
    this.mCounters[id] = { lastMeasure: this.now(), timeSlices: [] };
  }

  public addMeasure(id: number, count: number) {
    const now: number = this.now();

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
    this.mCounters[id].lastMeasure = now;
  }

  public stopCounter(id: number) {
    delete this.mCounters[id];
  }

  private moveHorizon() {
    const time = this.now();
    for (let i = 0; i < time - this.mMeasureTime; ++i) {
      this.mTimeSlices.shift();
    }
    this.mMeasureTime = time;
  }

  private now(): number {
    return Math.floor(new Date().getTime() / 1000);
  }
}

export default SpeedCalculator;
