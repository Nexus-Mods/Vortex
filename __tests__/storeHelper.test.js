import * as helper from '../out/util/storeHelper';

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
    helper.getSafe(input, ['a', 'test'], 42);
    expect(input).toEqual({});
  });
  it('sets the value even if nodes missing', () => {
    let res = helper.setSafe({}, ['a', 'test'], 42);
    expect(res).toEqual({ a: { test: 42 } });
  });
  it('changes the value if node not missing', () => {
    let input = { a: { test: 12 } };
    let res = helper.setSafe({}, ['a', 'test'], 42);
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

describe('currentGame', () => {
  it('returns the correct game', () => {
    let input = {
      settings: { gameMode: { current: 'testA' } },
      session: { gameMode: { known: [ { id: 'testA', name: '1' }, { id: 'testB', name: '2' } ] } }
    };
    expect(helper.currentGame(input).name).toBe('1');
  });
  it('returns placeholder if unset', () => {
    let input = {};
    expect(helper.currentGame(input).id).toBe('__placeholder');
  });
  it('returns placeholder if game not known', () => {
    let input = {
      settings: { gameMode: { current: 'testA' } },
      session: { gameMode: { known: [ { id: 'testB', name: '2' } ] } }
    };
    expect(helper.currentGame(input).id).toBe('__placeholder');
  });
});

describe('currentGameDiscovery', () => {
  it('returns the correct game', () => {
    let input = {
      settings: { gameMode: { current: 'testA',
                              discovered: { testA: 1, testB: 2 }
                            } },
    };
    expect(helper.currentGameDiscovery(input)).toBe(1);
  });
  it('returns undefined if unset', () => {
    let input = {};
    expect(helper.currentGameDiscovery(input)).toBeUndefined();
  });
  it('returns undefined if game not discovered', () => {
    let input = {
      settings: { gameMode: { current: 'testA',
                              discovered: { testB: 2 }
                            } },
    };
    expect(helper.currentGameDiscovery(input)).toBeUndefined();
  });
});

describe('currentProfile', () => {
  it('returns the correct profile', () => {
    let input = {
      gameSettings: { profiles: {
        currentProfile: 'testA', profiles: {
          testA: { id: 'testA', name: 1 },
          testB: { id: 'testB', name: 2 },
        }
      } } };
    expect(helper.currentProfile(input).name).toBe(1);
  });
  it('returns undefined if unset', () => {
    expect(helper.currentProfile({})).toBeUndefined();
  });
  it('returns undefined if profile missing', () => {
    let input = {
      gameSettings: { profiles: {
        currentProfile: 'testA', profiles: {
          testB: { id: 'testB', name: 2 },
        }
      } } };
    expect(helper.currentProfile(input)).toBeUndefined();
  });
});
