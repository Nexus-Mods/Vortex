/* eslint-env jest */
const path = require('path');

describe('macOS URL interception and architecture detection', () => {
  const compatPath = path.resolve(__dirname, '../api/lib/util/macOSGameCompatibility.js');
  const compat = require(compatPath);

  test('getMacOSArchitecture returns a known architecture', () => {
    const arch = compat.getMacOSArchitecture ? compat.getMacOSArchitecture() : null;
    expect(typeof arch).toBe('string');
    expect(['arm64', 'x64', 'unknown']).toContain(arch);
  });

  test('interceptDownloadURLForMacOS preserves unknown URLs', () => {
    const url = 'https://example.com/some-tool-win.zip';
    const intercepted = compat.interceptDownloadURLForMacOS(url);
    expect(typeof intercepted).toBe('string');
    expect(intercepted).toBe(url);
  });
});