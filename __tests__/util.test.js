import * as util from '../src/util/util';

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
});
