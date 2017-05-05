import * as Promise from 'bluebird';

/**
 * promise-equivalent of setTimeout
 *
 * @export
 * @param {number} durationMS
 * @param {*} [value]
 * @returns
 */
export function delayed(durationMS: number, value?: any) {
  let timer: NodeJS.Timer;
  let reject: (err: Error) => void;
  const res = new Promise((resolve, rejectPar) => {
    timer = setTimeout(() => {
      resolve(value);
    }, durationMS);
    reject = rejectPar;
  });
  res.cancel = () => {
    clearTimeout(timer);
    reject(new Error('delayed operation canceled'));
  };
  return res;
}

export default delayed;
