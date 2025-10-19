import { promiseMap, promiseFilter, promiseReduce, promiseEach, promiseMapSeries } from '../bluebird-migration-helpers.local';

describe('bluebird-migration-helpers', () => {
  describe('promiseMap', () => {
    it('should map array elements with async function', async () => {
      const array = [1, 2, 3];
      const mapper = async (item: number) => item * 2;
      const result = await promiseMap(array, mapper);
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe('promiseFilter', () => {
    it('should filter array elements with async function', async () => {
      const array = [1, 2, 3, 4, 5];
      const filter = async (item: number) => item % 2 === 0;
      const result = await promiseFilter(array, filter);
      expect(result).toEqual([2, 4]);
    });
  });

  describe('promiseReduce', () => {
    it('should reduce array elements with async function', async () => {
      const array = [1, 2, 3, 4];
      const reducer = async (acc: number, curr: number) => acc + curr;
      const result = await promiseReduce(array, reducer, 0);
      expect(result).toEqual(10);
    });
  });

  describe('promiseEach', () => {
    it('should iterate array elements with async function', async () => {
      const array = [1, 2, 3];
      const results: number[] = [];
      const iterator = async (item: number) => {
        results.push(item * 2);
      };
      const result = await promiseEach(array, iterator);
      expect(result).toEqual([1, 2, 3]);
      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('promiseMapSeries', () => {
    it('should map array elements sequentially with async function', async () => {
      const array = [1, 2, 3];
      const mapper = async (item: number) => item * 2;
      const result = await promiseMapSeries(array, mapper);
      expect(result).toEqual([2, 4, 6]);
    });
  });
});