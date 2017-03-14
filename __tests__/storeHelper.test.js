import * as helper from '../src/util/storeHelper';

describe('getSafe', () => {
  it('returns the default if empty', () => {
    let res = helper.getSafe({}, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the default if node missing', () => {
    let res = helper.getSafe({ this: { is: { no: 13 } } }, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the default if part of path is a value', () => {
    let res = helper.getSafe({ this: { is: { a: 13 } } }, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the value if path is valid', () => {
    let res = helper.getSafe({ this: { value: 'valid' } }, ['this', 'value'], 42);
    expect(res).toBe('valid');
  });
});

describe('setSafe', () => {
  it('leaves the original unmodified', () => {
    let input = {};
    helper.setSafe(input, ['a', 'test']);
    expect(input).toEqual({});
  });
  it('copies only the parts being modified', () => {
    let input = { a: { a1: 42 }, b: { b1: 13 } };
    let res = helper.setSafe(input, ['b', 'b1'], 12);
    expect(res.a).toBe(input.a);
  });
  it('sets the value even if nodes missing', () => {
    let res = helper.setSafe({}, ['a', 'test'], 42);
    expect(res).toEqual({ a: { test: 42 } });
  });
  it('changes the value if node not missing', () => {
    let input = { a: { test: 12 }, b: 13 };
    let res = helper.setSafe(input, ['a', 'test'], 42);
    expect(res).toEqual({ a: { test: 42 }, b: 13 });
  });
  it('works with empty path', () => {
    let input = { a: 42 };
    let res = helper.setSafe(input, [], { b: 13 });
    expect(res).toEqual({ b: 13 });
  });
  it('works with arrays', () => {
    let input = { arr: [ 41 ] };
    let res = helper.setSafe(input, ['arr', 0], 42);
    expect(res).toEqual({ arr: [42] });
  });
});

describe('setOrNop', () => {
  it('leaves the original unmodified', () => {
    let input = {};
    helper.setOrNop(input, ['a', 'test'], 42);
    expect(input).toEqual({});
  });
  it('leaves unmodified if node missing', () => {
    let input = {};
    let res = helper.setOrNop(input, ['a', 'test'], 42);
    expect(res).toBe(input);
  });
  it('changes the value if node not missing', () => {
    let input = { a: { test: 12 } };
    let res = helper.setOrNop(input, ['a', 'test'], 42);
    expect(res).toEqual({ a: { test: 42 } });
  });
});

describe('changeOrNop', () => {
  it('leaves the original unmodified', () => {
    let input = {};
    helper.changeOrNop(input, ['a', 'test'], 42);
    expect(input).toEqual({});
  });
  it('leaves unmodified if key missing', () => {
    let input = { a: {} };
    let res = helper.changeOrNop(input, ['a', 'test'], 42);
    expect(res).toBe(input);
  });
  it('changes the value if node not missing', () => {
    let input = { a: { test: 12 } };
    let res = helper.changeOrNop(input, ['a', 'test'], 42);
    expect(res).toEqual({ a: { test: 42 } });
  });
});

describe('pushSafe', () => {
  it('leaves the original unmodified', () => {
    let input = {};
    helper.pushSafe(input, [ 'someList' ], 'a');
    expect(input).toEqual({});
  });
  it('appends to a list', () => {
    let input = { someList: ['a'] };
    let res = helper.pushSafe(input, [ 'someList' ], 'b');
    expect(res).toEqual({ someList: ['a', 'b'] });
  });
  it('sets the value even if node missing', () => {
    let res = helper.pushSafe({}, [ 'someList' ], 'a');
    expect(res).toEqual({ someList: ['a'] });
  });
});

describe('removeValue', () => {
  it('leaves the original unmodified', () => {
    let input = { someList: ['a', 'b', 'c'] };
    helper.removeValue(input, ['someList'], 'b');
    expect(input).toEqual({ someList: ['a', 'b', 'c'] });
  });
  it('removes the correct value', () => {
    let input = { someList: ['a', 'b', 'c'] };
    let res = helper.removeValue(input, ['someList'], 'b');
    expect(res).toEqual({ someList: ['a', 'c'] });
  });
  it('returns unmodified if the value doesn\'t exist', () => {
    let input = { someList: ['a', 'b', 'c'] };
    let res = helper.removeValue(input, ['someList'], 'd');
    expect(res).toEqual({ someList: ['a', 'b', 'c'] });
    // it does copy the input however
  });
  it('returns empty list if the node is missing', () => {
    let input = {};
    let res = helper.removeValue(input, ['someList'], 'a');
    expect(res).toEqual({ someList: [] });
  });
});

describe('merge', () => {
  it('leaves the original unmodified', () => {
    let input = { someobj: { a: 1, b: 2 } };
    helper.merge(input, ['someobj'], { b: 42 });
    expect(input).toEqual({ someobj: { a: 1, b: 2 } });
  });
  it('changes an existing object', () => {
    let input = { someobj: { a: 1, b: 2 } };
    let res = helper.merge(input, ['someobj'], { b: 42 });
    expect(res).toEqual({ someobj: { a: 1, b: 42 } });
  });
  it('creates the object if necessary', () => {
    let res = helper.merge({}, ['someobj'], { b: 42 });
    expect(res).toEqual({ someobj: { b: 42 } });
  });
});

describe('deleteOrNop', () => {
  it('leaves the original unomdified', () => {
    let input = { a: 1, b: 2 };
    let copy = Object.assign({}, input);
    helper.deleteOrNop(input, ['a']);
    expect(input).toEqual(copy);
  });
  it('leaves unmodified if key missing', () => {
    const input = { b: 2 };
    let result = helper.deleteOrNop(input, ['a']);
    expect(result).toBe(input);
  });
  it('leaves unmodified if node missing', () => {
    const input = { b: { y: 2 } };
    let result = helper.deleteOrNop(input, ['a', 'x']);
    expect(result).toBe(input);
  });
  it('removes the specified element', () => {
    let input = { a: 1, b: 2 };
    let result = helper.deleteOrNop(input, ['a']);
    expect(result).toEqual({ b: 2 });
  });
});
