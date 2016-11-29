import getAttr from '../src/util/getAttr';

describe('getAttr', () => {
  it('returns default on undefined dict', () => {
    expect(getAttr(undefined, 'answer', 42)).toBe(42);
  });

  it('returns default on null dict', () => {
    expect(getAttr(null, 'answer', 42)).toBe(42);
  });

  it('returns default if key is missing', () => {
    expect(getAttr({ wrong: 43 }, 'answer', 42)).toBe(42);
  });

  it('returns value if key exists', () => {
    expect(getAttr({ wrong: 43 }, 'wrong', 42)).toBe(43);
  });
});
