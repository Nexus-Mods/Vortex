import NXMUrl from '../out/extensions/nexus_integration/NXMUrl';

describe('NXMUrl', () => {
  it('parses correctly', () => {
    const url = new NXMUrl('nxm://Fallout4/mods/123/files/456');
    expect(url.gameName).toBe('Fallout4');
    expect(url.modId).toBe(123);
    expect(url.fileId).toBe(456);
  });
});
