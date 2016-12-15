import NXMUrl from '../src/extensions/nexus_integration/NXMUrl';

describe('NXMUrl', () => {
  it('parses correctly', () => {
    const url = new NXMUrl('nxm://Fallout4/mods/123/files/456');
    expect(url.gameId).toBe('Fallout4');
    expect(url.modId).toBe(123);
    expect(url.fileId).toBe(456);
  });
  it('throws on invalid url', () => {
    expect(() => new NXMUrl('gugu')).toThrow(new Error('invalid nxm url "gugu"'));
  });
});
