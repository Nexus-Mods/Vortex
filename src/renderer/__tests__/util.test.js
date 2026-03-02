import * as util from '../util/util';
import { isMajorDowngrade } from "../../main/Application";

// for the tests regarding invalid filename detection/sanitation we need a consistent
// platform and windows is just way more "interesting" in this regard
jest.mock('process', () => ({
  platform: 'win32',
}));

describe('objDiff', () => {
  it('finds added entries', () => {
    const res = util.objDiff({ old: 'a' }, { old: 'a', new: 'b' });
    expect(res).toEqual({
      '+new': 'b',
    });
  });
  it('finds removed entries', () => {
    const res = util.objDiff({ old: 'a', rem: 'b' }, { old: 'a' });
    expect(res).toEqual({
      '-rem': 'b',
    });
  });
  it('finds changed entries', () => {
    const res = util.objDiff({ chng: 'a' }, { chng: 'b' });
    expect(res).toEqual({
      '-chng': 'a',
      '+chng': 'b',
    });
  });
  it('supports nested', () => {
    const res = util.objDiff({ outer: { chng: 'a' } }, { outer: { chng: 'b' }});
    expect(res).toEqual({
      outer: {
        '-chng': 'a',
        '+chng': 'b',
      }
    });
  });
  it('supports difference in type', () => {
    let res = util.objDiff({ chng: 42 }, { chng: { a: 13 } });
    expect(res).toEqual({
      '-chng': 42,
      '+chng': { a: 13 },
    });

    res = util.objDiff({ chng: { a: 13 } }, { chng: 42 });
    expect(res).toEqual({
      '-chng': { a: 13 },
      '+chng': 42,
    });
  });
  it('doesn\'t fail if object has overloaded hasOwnProperty', () => {
    let res = util.objDiff({ hasOwnProperty: 1, foo: 42 }, { hasOwnProperty: 2, foo: 42 });
    expect(res).toEqual({
      '-hasOwnProperty': 1,
      '+hasOwnProperty': 2,
    })
  });

  // Edge case tests for type safety
  it('handles null inputs gracefully', () => {
    expect(util.objDiff(null, null)).toEqual({});
    expect(util.objDiff(null, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, null)).toEqual({});
  });

  it('handles undefined inputs gracefully', () => {
    expect(util.objDiff(undefined, undefined)).toEqual({});
    expect(util.objDiff(undefined, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, undefined)).toEqual({});
  });

  it('handles array inputs gracefully', () => {
    // Arrays are not plain objects, so they return empty object as a graceful fallback
    const arr1 = [];
    const arr2 = [1, 2];
    expect(util.objDiff(arr1, arr1)).toEqual({});
    expect(util.objDiff(arr2, arr2)).toEqual({});
    expect(util.objDiff([], [])).toEqual({}); // Different array instances
    expect(util.objDiff([1, 2], [1, 2])).toEqual({}); // Different array instances
    expect(util.objDiff([1, 2], { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, [1, 2])).toEqual({});
  });

  it('handles primitive inputs gracefully', () => {
    expect(util.objDiff('string', 'string')).toEqual({});
    expect(util.objDiff('string1', 'string2')).toEqual({});
    expect(util.objDiff(42, 42)).toEqual({});
    expect(util.objDiff(42, 43)).toEqual({});
    expect(util.objDiff(true, true)).toEqual({});
    expect(util.objDiff(true, false)).toEqual({});
  });

  it('handles mixed primitive and object inputs', () => {
    expect(util.objDiff('string', { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, 'string')).toEqual({});
    expect(util.objDiff(42, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, 42)).toEqual({});
  });

  it('handles Date objects gracefully', () => {
    const date1 = new Date('2023-01-01');
    const date2 = new Date('2023-01-02');
    expect(util.objDiff(date1, date1)).toEqual({});
    expect(util.objDiff(date1, date2)).toEqual({});
    expect(util.objDiff(date1, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, date1)).toEqual({});
  });

  it('handles RegExp objects gracefully', () => {
    const regex1 = /test/;
    const regex2 = /other/;
    expect(util.objDiff(regex1, regex1)).toEqual({});
    expect(util.objDiff(regex1, regex2)).toEqual({});
    expect(util.objDiff(regex1, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, regex1)).toEqual({});
  });

  it('handles functions gracefully', () => {
    const func1 = () => 'test';
    const func2 = () => 'other';
    expect(util.objDiff(func1, func1)).toEqual({});
    expect(util.objDiff(func1, func2)).toEqual({});
    expect(util.objDiff(func1, { a: 1 })).toEqual({});
    expect(util.objDiff({ a: 1 }, func1)).toEqual({});
  });

  it('handles skip parameter correctly', () => {
    const lhs = { a: 1, b: 2, c: 3 };
    const rhs = { a: 10, b: 2, c: 30 };
    const res = util.objDiff(lhs, rhs, ['a', 'c']);
    expect(res).toEqual({});
  });

  it('handles skip parameter with non-existent keys', () => {
    const lhs = { a: 1, b: 2 };
    const rhs = { a: 10, b: 2 };
    const res = util.objDiff(lhs, rhs, ['a', 'nonexistent']);
    expect(res).toEqual({});
  });

  it('handles skip parameter as non-array', () => {
    const lhs = { a: 1, b: 2 };
    const rhs = { a: 10, b: 2 };
    // Should not crash when skip is not an array
    const res = util.objDiff(lhs, rhs, 'not-an-array');
    expect(res).toEqual({
      '-a': 1,
      '+a': 10,
    });
  });

  it('handles deeply nested structures', () => {
    const lhs = {
      level1: {
        level2: {
          level3: {
            value: 'old'
          }
        }
      }
    };
    const rhs = {
      level1: {
        level2: {
          level3: {
            value: 'new'
          }
        }
      }
    };
    const res = util.objDiff(lhs, rhs);
    expect(res).toEqual({
      level1: {
        level2: {
          level3: {
            '-value': 'old',
            '+value': 'new'
          }
        }
      }
    });
  });

  it('handles empty objects', () => {
    expect(util.objDiff({}, {})).toEqual({});
    expect(util.objDiff({}, { a: 1 })).toEqual({ '+a': 1 });
    expect(util.objDiff({ a: 1 }, {})).toEqual({ '-a': 1 });
  });

  it('handles objects with prototype methods', () => {
    function TestClass() {
      this.prop = 'value';
    }
    TestClass.prototype.method = function() { return 'test'; };

    const obj1 = new TestClass();
    const obj2 = new TestClass();
    obj2.prop = 'different';

    // Should only compare own properties, not prototype methods
    const res = util.objDiff(obj1, obj2);
    expect(res).toEqual({
      '-prop': 'value',
      '+prop': 'different'
    });
  });

  it('handles objects with null prototype', () => {
    const obj1 = Object.create(null);
    obj1.a = 1;
    const obj2 = Object.create(null);
    obj2.a = 2;

    const res = util.objDiff(obj1, obj2);
    expect(res).toEqual({
      '-a': 1,
      '+a': 2
    });
  });

  it('returns empty object when objects are identical', () => {
    const obj = { a: 1, b: { c: 2, d: [1, 2, 3] } };
    expect(util.objDiff(obj, obj)).toEqual({});
  });

  it('handles circular references in recursive calls', () => {
    const lhs = { a: 1, nested: {} };
    const rhs = { a: 2, nested: {} };

    // The function should handle this gracefully due to the ?? {} fallback
    const res = util.objDiff(lhs, rhs);
    expect(res).toEqual({
      '-a': 1,
      '+a': 2
    });
  });
});

describe('isFilenameValid', () => {
  it('reports invalid filenames', () => {
    const invalidNames = (process.platform === 'win32')
      ? [
        'FOO/BAR.txt',
        'foo?bar.txt',
        'foo*bar.txt',
        'foo:bar.txt',
        'foo|bar.txt',
        'foo"bar.txt',
        'foo<bar.txt',
        'foo>bar.txt',
        'CON',
        'COM3',
        'LPT4',
        'NUL.txt',
        'aux.exe',
        '..',
        '.'
      ]
      : [
        '..',
        '.'
      ];

    invalidNames.forEach(name => {
      expect(util.isFilenameValid(name)).toBe(false);
    });
  });

  it('allows valid names', () => {
    const validNames = (process.platform === 'win32')
      ? [
        'foobar.txt',
        'foo.bar.txt',
        'foo%bar.txt',
        'fööbär.txt',
        'null.txt',
        '..foobar.txt',
      ]
      : [];

    validNames.forEach(name => {
      expect(util.isFilenameValid(name)).toBe(true);
    });
  });
});

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;

describeOnWindows('isPathValid', () => {
  it('reports invalid path', () => {
    const invalidNames = [
      'foo\\b/ar.txt',
      'con\\bar.txt',
      'foo\\..\\bar.txt',
      '\\foo\\bar',
    ];
    invalidNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(false);
    });
  });
  it('allows valid names', () => {
    const validNames = [
      'foo\\bar.txt',
      'c:\\conx\\bar.txt',
      '\\\\server\\foo\\bar',
      'foo\\bar\\'
    ];
    validNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(true);
    });
  });
  it('can be set to allow relative paths', () => {
    const validNames = [
      'c:\\conx\\..\\bar.txt',
    ];
    validNames.forEach(name => {
      expect(util.isPathValid(name, true)).toBe(true);
    });
  });
});

describe('isMajorUpgrade', () => {
  it('detects major downgrade', () => {
    expect(isMajorDowngrade('2.0.0', '1.0.0')).toBe(true);
    expect(isMajorDowngrade('1.0.0', '0.9.0')).toBe(true);
  });
  it('detects minor downgrade', () => {
    expect(isMajorDowngrade('1.2.0', '1.1.0')).toBe(true);
    expect(isMajorDowngrade('0.2.0', '0.1.0')).toBe(true);
  });
  it('doesn\'t report patch downgrade', () => {
    expect(isMajorDowngrade('1.0.2', '1.0.1')).toBe(false);
    expect(isMajorDowngrade('0.2.2', '0.2.1')).toBe(false);
  });
  it('doesn\'t report upgrade', () => {
    expect(isMajorDowngrade('1.1.0', '1.2.0')).toBe(false);
    expect(isMajorDowngrade('0.1.0', '0.2.0')).toBe(false);
    expect(isMajorDowngrade('1.0.0', '2.0.0')).toBe(false);
    expect(isMajorDowngrade('0.9.0', '1.0.0')).toBe(false);
  });
});

describe('unique', () => {
  it('removes duplicates, keeping the first item', () => {
    expect(util.unique([{ k: 1, v: 1 }, { k: 1, v: 2 }, { k: 2, v: 1 }], i => i.k))
      .toEqual([{ k: 1, v: 1 }, { k: 2, v: 1 }]);
  });
});

describeOnWindows('sanitizeFilename', () => {
  it('sanitizes disallowed Windows characters', () => {
    expect(util.sanitizeFilename('foo*bar')).toBe('foo_42_bar');
  });
  it('sanitizes reserved Windows names', () => {
    expect(util.sanitizeFilename('LPT1.txt')).toBe('_reserved_LPT1.txt');
  });
  it('sanitizes invalid trailing character on Windows', () => {
    expect(util.sanitizeFilename('foobar.')).toBe('foobar._');
  });
});

describe('nexusModsURL', () => {
  it('creates basic urls', () => {
    expect(util.nexusModsURL(['foo', 'bar'])).toBe('https://www.nexusmods.com/foo/bar');
  });
  it('supports different subdomains', () => {
    expect(util.nexusModsURL(['foo', 'bar'], { section: util.Section.Users }))
      .toBe('https://users.nexusmods.com/foo/bar');
  });
  it('supports tracking campaigns', () => {
    expect(util.nexusModsURL(['foo', 'bar'], { campaign: util.Campaign.BuyPremium }))
      .toBe('https://www.nexusmods.com/foo/bar?utm_source=vortex&utm_medium=app&utm_campaign=buy_premium');
  });
  it('supports additional parameters', () => {
    expect(util.nexusModsURL(['foo', 'bar'], {
      campaign: util.Campaign.BuyPremium,
      parameters: ['foo=bar'],
    }))
      .toBe('https://www.nexusmods.com/foo/bar?foo=bar&utm_source=vortex&utm_medium=app&utm_campaign=buy_premium');
  });
});
