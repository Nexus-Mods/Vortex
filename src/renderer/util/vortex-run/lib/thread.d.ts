import type PromiseBB from "bluebird";
declare function runThreaded(
  func: (...args: any[]) => any,
  moduleBase: string,
  ...args: any[]
): PromiseBB<any>;
export default runThreaded;
