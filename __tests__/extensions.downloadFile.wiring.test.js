/* eslint-env jest */
const fs = require('fs');
const path = require('path');

describe('downloadFile wiring in util.ts', () => {
  const utilTsPath = path.resolve(__dirname, '../src/extensions/extension_manager/util.ts');

  test('includes macOS URL interception hook', () => {
    const content = fs.readFileSync(utilTsPath, 'utf8');
    expect(content).toMatch(/interceptDownloadURLForMacOS/);
    expect(content).toMatch(/const interceptedUrl = interceptDownloadURLForMacOS\(url\)/);
  });
});