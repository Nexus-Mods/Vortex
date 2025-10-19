// Promise helper functions to replace Bluebird methods

/**
 * Promise-based filter implementation
 * Original: promise.filter(array, filterFunction, options)
 * Replace with:
 */
export const promiseFilter = async <T>(array: T[], filterFunction: (item: T) => Promise<boolean>): Promise<T[]> => {
  const results = await Promise.all(array.map(item => filterFunction(item)));
  return array.filter((_, index) => results[index]);
};

/**
 * Promise-based mapping implementation
 * Original: promise.map(array, mapperFunction, options)
 * Replace with:
 */
export const promiseMap = async <T, R>(array: T[], mapperFunction: (item: T) => Promise<R>): Promise<R[]> => {
  return Promise.all(array.map(mapperFunction));
};

/**
 * Promise-based sequential mapping implementation
 * Original: promise.mapSeries(array, mapperFunction)
 * Replace with:
 */
export const promiseMapSeries = async <T, R>(array: T[], mapperFunction: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < array.length; i++) {
    results.push(await mapperFunction(array[i]));
  }
  return results;
};

/**
 * Promise-based reduction implementation
 * Original: promise.reduce(array, reducerFunction, initialValue)
 * Replace with:
 */
export const promiseReduce = async <T, R>(array: T[], reducerFunction: (accumulator: R, current: T) => Promise<R>, initialValue: R): Promise<R> => {
  let accumulator = initialValue;
  for (let i = 0; i < array.length; i++) {
    accumulator = await reducerFunction(accumulator, array[i]);
  }
  return accumulator;
};

/**
 * Promise-based sequential iteration implementation
 * Original: promise.each(array, iteratorFunction)
 * Replace with:
 */
export const promiseEach = async <T>(array: T[], iteratorFunction: (item: T) => Promise<void>): Promise<T[]> => {
  for (let i = 0; i < array.length; i++) {
    await iteratorFunction(array[i]);
  }
  return array;
};

/**
 * Promise-based delay implementation
 * Original: promise.delay(ms) or promise.delay(ms, value)
 * Replace with:
 */
export const promiseDelay = <T>(ms: number, value?: T): Promise<T> => {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
};

/**
 * Promise-based join implementation
 * Original: promise.join(promise1, promise2, ..., combinerFunction)
 * Replace with:
 */
export const promiseJoin = async <T extends any[], R>(...args: [...T, (...results: T) => R]): Promise<R> => {
  const combinerFunction = args.pop() as (...results: T) => R;
  const promises = args as unknown as T;
  const results = await Promise.all(promises);
  return combinerFunction(...results as any);
};