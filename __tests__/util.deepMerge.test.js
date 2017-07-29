import deepMerge from '../src/util/deepMerge';

describe('deepMerge', () => {
  it('merges objects without intersection', () => {
    let lhs = { a: 1, b: 2 };
    let rhs = { c: 3, d: 4 };
    expect(deepMerge(lhs, rhs)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });

  it('uses right side over left', () => {
    let lhs = { a: 1, b: 2 };
    let rhs = { b: 3, c: 4 };
    expect(deepMerge(lhs, rhs)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('replaces undefined with value', () => {
    let lhs = { a: 1, b: undefined };
    let rhs = { b: 3, c: 4 };
    expect(deepMerge(lhs, rhs)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('replaces undefined with null', () => {
    let lhs = { a: 1, b: undefined, d: 1 };
    let rhs = { b: null, c: 4, d: 2 };
    expect(deepMerge(lhs, rhs)).toEqual({ a: 1, b: null, c: 4, d: 2 });
    expect(deepMerge(rhs, lhs)).toEqual({ a: 1, b: null, c: 4, d: 1 });
  });

  it('replaces undefined with empty list', () => {
    let lhs = { a: 1, b: undefined, d: 1 };
    let rhs = { b: [], c: 4, d: 2 };
    expect(deepMerge(lhs, rhs)).toEqual({ a: 1, b: [], c: 4, d: 2 });
    expect(deepMerge(rhs, lhs)).toEqual({ a: 1, b: [], c: 4, d: 1 });
  });
});
