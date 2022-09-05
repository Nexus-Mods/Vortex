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

describe('getSafeCI', () => {
  it('returns the default if empty', () => {
    let res = helper.getSafeCI({}, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the default if node missing', () => {
    let res = helper.getSafeCI({ this: { is: { no: 13 } } }, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the default if part of path is a value', () => {
    let res = helper.getSafeCI({ this: { is: { a: 13 } } }, ['this', 'is', 'a', 'test'], 42);
    expect(res).toBe(42);
  });
  it('returns the value if path is valid', () => {
    let res = helper.getSafeCI({ this: { value: 'valid' } }, ['this', 'value'], 42);
    expect(res).toBe('valid');
  });
  it('returns the result if the keys are specified with different case', () => {
    let res = helper.getSafeCI({ this: { value: 'valid' } }, ['tHiS', 'VaLuE'], 42);
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
  it('can append to array', () => {
    let input = { arr: [ 41 ] };
    let res = helper.setSafe(input, ['arr', 1], 42);
    expect(res).toEqual({ arr: [41, 42] });
  });
  it('can append to array with gaps', () => {
    let input = { arr: [ 41 ] };
    let res = helper.setSafe(input, ['arr', 2], 42);
    expect(res).toEqual({ arr: [41, undefined, 42] });
  });
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: 2 }, { x: 3 } ] };
    let result = helper.setSafe(input, ['a', 1, 'x'], 1);
    expect(result).toEqual({ a: [ { x: 2 }, { x: 1 } ] });
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
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: 2 }, { x: 3 } ] };
    let result = helper.setOrNop(input, ['a', 1, 'x'], 1);
    expect(result).toEqual({ a: [ { x: 2 }, { x: 1 } ] });
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
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: 2 }, { x: 3 } ] };
    let result = helper.changeOrNop(input, ['a', 1, 'x'], 1);
    expect(result).toEqual({ a: [ { x: 2 }, { x: 1 } ] });
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
  it('works with numeric path component', () => {
    let input = { tl: [ { a: [ 1, 2 ] } ] };
    let res = helper.pushSafe(input, [ 'tl', 0, 'a' ], 3);
    expect(res).toEqual({ tl: [ { a: [ 1, 2, 3 ] } ] });
  });
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: [1] } ] };
    let result = helper.pushSafe(input, ['a', 0, 'x'], 2);
    expect(result).toEqual({ a: [ { x: [1, 2] } ] });
  });
  it('creates intermediate dictionaries', () => {
    let input = {};
    let result = helper.pushSafe(input, ['a', 'b'], 42);
    expect(result).toEqual({ a: { b: [42] } });
  });
  it('creates base', () => {
    let result = helper.pushSafe(undefined, ['a', 'b'], 42);
    expect(result).toEqual({ a: { b: [42] } });
  });
  it('turns intermediate non-objects into objects', () => {
    let input = { a: 13 };
    let result = helper.pushSafe(input, ['a', 'b'], 42);
    expect(result).toEqual({ a: { b: [42] } });
  });
  it('turns final element into array if it isn\'t one', () => {
    let input = { a: 13 };
    let result = helper.pushSafe(input, ['a'], 42);
    expect(result).toEqual({ a: [42] });
  });});

describe('addUniqueSafe', () => {
  it('leaves the original unmodified', () => {
    let input = {};
    helper.addUniqueSafe(input, [ 'someList' ], 'a');
    expect(input).toEqual({});
  });
  it('inserts to a list if not present yet', () => {
    let input = { someList: ['a'] };
    let res = helper.addUniqueSafe(input, [ 'someList' ], 'b');
    expect(res).toEqual({ someList: ['a', 'b'] });
  });
  it('returns original list of value exists', () => {
    let input = { someList: ['a'] };
    let res = helper.addUniqueSafe(input, [ 'someList' ], 'a');
    expect(res).toEqual(input);
  });
  it('sets the value even if node missing', () => {
    let res = helper.addUniqueSafe({}, [ 'someList' ], 'a');
    expect(res).toEqual({ someList: ['a'] });
  });
  it('works with numeric path component', () => {
    let input = { tl: [ { a: [ 1, 2 ] } ] };
    let res = helper.addUniqueSafe(input, [ 'tl', 0, 'a' ], 3);
    expect(res).toEqual({ tl: [ { a: [ 1, 2, 3 ] } ] });
  });
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: [1] } ] };
    let result = helper.addUniqueSafe(input, ['a', 0, 'x'], 2);
    expect(result).toEqual({ a: [ { x: [1, 2] } ] });
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
    expect(res).toBe(input);
  });
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: [1, 2] } ] };
    let result = helper.removeValue(input, ['a', 0, 'x'], 2);
    expect(result).toEqual({ a: [ { x: [1] } ] });
  });
});

describe('removeValueIf', () => {
  it('returns empty list if input undefined', () => {
    let input = { foobar: undefined };
    let res = helper.removeValueIf(input, ['foobar'], () => true);
    expect(res).toEqual({ foobar: [] });
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
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: 1 } ] };
    let result = helper.merge(input, ['a', 0], { x: 2, y: 3 });
    expect(result).toEqual({ a: [ { x: 2, y: 3 } ] });
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
  it('doesn\'t turn arrays into objects', () => {
    let input = { a: [ { x: 2 }, { x: 3 } ] };
    let result = helper.deleteOrNop(input, ['a', 1]);
    expect(result).toEqual({ a: [ { x: 2 } ] });
  });
});
