import * as util from '../util/util';

describe('objDiff edge cases that could cause TypeError', () => {
  describe('type safety for Object.keys calls', () => {
    it('handles null values that were causing the original TypeError', () => {
      // This was the original problematic case
      expect(() => util.objDiff({ key: null }, { key: null })).not.toThrow();
      expect(() => util.objDiff(null, { key: 'value' })).not.toThrow();
      expect(() => util.objDiff({ key: 'value' }, null)).not.toThrow();
    });

    it('handles undefined values safely', () => {
      expect(() => util.objDiff({ key: undefined }, { key: undefined })).not.toThrow();
      expect(() => util.objDiff(undefined, { key: 'value' })).not.toThrow();
      expect(() => util.objDiff({ key: 'value' }, undefined)).not.toThrow();
    });

    it('handles arrays that would fail Object.keys().forEach', () => {
      const arr1 = [1, 2, 3];
      const arr2 = ['a', 'b', 'c'];
      
      expect(() => util.objDiff(arr1, arr2)).not.toThrow();
      expect(() => util.objDiff(arr1, { 0: 1, 1: 2, 2: 3 })).not.toThrow();
      expect(() => util.objDiff({ 0: 1, 1: 2, 2: 3 }, arr1)).not.toThrow();
    });

    it('handles primitive types that cannot have Object.keys called on them', () => {
      expect(() => util.objDiff('string', 'string')).not.toThrow();
      expect(() => util.objDiff(42, 42)).not.toThrow();
      expect(() => util.objDiff(true, false)).not.toThrow();
      expect(() => util.objDiff(Symbol('test'), Symbol('test'))).not.toThrow();
    });

    it('handles built-in objects safely', () => {
      const date1 = new Date();
      const date2 = new Date();
      const regex1 = /test/g;
      const regex2 = /other/i;
      const func1 = () => 'test';
      const func2 = function() { return 'other'; };

      expect(() => util.objDiff(date1, date2)).not.toThrow();
      expect(() => util.objDiff(regex1, regex2)).not.toThrow();
      expect(() => util.objDiff(func1, func2)).not.toThrow();
    });

    it('handles Map and Set objects safely', () => {
      const map1 = new Map([['key', 'value']]);
      const map2 = new Map([['key', 'different']]);
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([4, 5, 6]);

      expect(() => util.objDiff(map1, map2)).not.toThrow();
      expect(() => util.objDiff(set1, set2)).not.toThrow();
      expect(() => util.objDiff(map1, { key: 'value' })).not.toThrow();
      expect(() => util.objDiff({ key: 'value' }, set1)).not.toThrow();
    });
  });

  describe('recursive calls with problematic values', () => {
    it('handles nested null values without throwing', () => {
      const obj1 = { nested: null };
      const obj2 = { nested: { key: 'value' } };
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      // When comparing null to object, they are treated as different primitive values
      expect(result).toEqual({
        '-nested': null,
        '+nested': { key: 'value' }
      });
    });

    it('handles nested undefined values without throwing', () => {
      const obj1 = { nested: undefined };
      const obj2 = { nested: { key: 'value' } };
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      // When comparing undefined to object, they are treated as different primitive values
      expect(result).toEqual({
        '-nested': undefined,
        '+nested': { key: 'value' }
      });
    });

    it('handles nested arrays without throwing', () => {
      const obj1 = { nested: [1, 2, 3] };
      const obj2 = { nested: { 0: 1, 1: 2, 2: 3 } };
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      expect(result).toEqual({
        '-nested': [1, 2, 3],
        '+nested': { 0: 1, 1: 2, 2: 3 }
      });
    });

    it('handles deeply nested problematic structures', () => {
      const obj1 = {
        level1: {
          level2: {
            problematic: null
          }
        }
      };
      const obj2 = {
        level1: {
          level2: {
            problematic: [1, 2, 3]
          }
        }
      };
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      expect(result).toEqual({
        level1: {
          level2: {
            '-problematic': null,
            '+problematic': [1, 2, 3]
          }
        }
      });
    });
  });

  describe('Object.keys edge cases', () => {
    it('handles objects created with Object.create(null)', () => {
      const obj1 = Object.create(null);
      obj1.key = 'value1';
      const obj2 = Object.create(null);
      obj2.key = 'value2';
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      expect(result).toEqual({
        '-key': 'value1',
        '+key': 'value2'
      });
    });

    it('handles objects with non-enumerable properties', () => {
      const obj1 = {};
      const obj2 = {};
      Object.defineProperty(obj1, 'hidden', {
        value: 'secret1',
        enumerable: false
      });
      Object.defineProperty(obj2, 'hidden', {
        value: 'secret2',
        enumerable: false
      });
      obj1.visible = 'seen1';
      obj2.visible = 'seen2';
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      // Should only see enumerable properties
      expect(result).toEqual({
        '-visible': 'seen1',
        '+visible': 'seen2'
      });
    });

    it('handles frozen and sealed objects', () => {
      const obj1 = Object.freeze({ key: 'frozen' });
      const obj2 = Object.seal({ key: 'sealed' });
      
      expect(() => util.objDiff(obj1, obj2)).not.toThrow();
      const result = util.objDiff(obj1, obj2);
      expect(result).toEqual({
        '-key': 'frozen',
        '+key': 'sealed'
      });
    });
  });

  describe('performance and memory edge cases', () => {
    it('handles large objects without stack overflow', () => {
      const createLargeObject = (size) => {
        const obj = {};
        for (let i = 0; i < size; i++) {
          obj[`key${i}`] = `value${i}`;
        }
        return obj;
      };

      const large1 = createLargeObject(1000);
      const large2 = createLargeObject(1000);
      large2.key999 = 'different';

      expect(() => util.objDiff(large1, large2)).not.toThrow();
      const result = util.objDiff(large1, large2);
      expect(result).toEqual({
        '-key999': 'value999',
        '+key999': 'different'
      });
    });

    it('handles objects with many levels of nesting', () => {
      const createDeepObject = (depth) => {
        let obj = { value: 'deep' };
        for (let i = 0; i < depth; i++) {
          obj = { [`level${i}`]: obj };
        }
        return obj;
      };

      const deep1 = createDeepObject(50);
      const deep2 = createDeepObject(50);
      // Modify the deepest value
      let current2 = deep2;
      for (let i = 49; i >= 0; i--) {
        current2 = current2[`level${i}`];
      }
      current2.value = 'different';

      expect(() => util.objDiff(deep1, deep2)).not.toThrow();
      // Should find the difference at the deepest level
      const result = util.objDiff(deep1, deep2);
      expect(result).toBeTruthy();
    });
  });
});
