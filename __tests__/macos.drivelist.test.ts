/* eslint-env jest */
import getDriveList from '../src/extensions/gamemode_management/util/getDriveList';

// Create a minimal api mock implementing showErrorNotification
const api = {
  showErrorNotification: jest.fn(),
} as any;

// Helper to mock platform as macOS and fs/promises readdir/stat behavior
function mockPlatformMac() {
  jest.doMock('../src/util/platform', () => ({
    isWindows: () => false,
    isMacOS: () => true,
  }));
}

function mockFsPromises({
  volumesEntries,
  statDirs,
  readdirError,
}: {
  volumesEntries?: string[];
  statDirs?: Set<string>;
  readdirError?: Error;
}) {
  const entries = volumesEntries ?? ['Macintosh HD', 'External', 'Time Machine'];
  const dirs = statDirs ?? new Set(['/Volumes/Macintosh HD', '/Volumes/External']);
  const ENOENT = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

  jest.doMock('fs/promises', () => ({
    __esModule: true,
    readdir: jest.fn(() => {
      if (readdirError) return Promise.reject(readdirError);
      return Promise.resolve(entries);
    }),
    stat: jest.fn((p: string) => {
      if (dirs.has(p)) return Promise.resolve({ isDirectory: () => true });
      // Non-dirs or inaccessible
      return Promise.reject(ENOENT);
    }),
  }));
}

describe('getDriveList macOS', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('includes root / and directories under /Volumes', async () => {
    mockPlatformMac();
    mockFsPromises({
      volumesEntries: ['Macintosh HD', 'External', 'NotADir'],
      statDirs: new Set(['/Volumes/Macintosh HD', '/Volumes/External']),
    });

    const drives = await new Promise<string[]>((resolve) => {
      jest.isolateModules(async () => {
        const mod = require('../src/extensions/gamemode_management/util/getDriveList');
        const res = await mod.default(api);
        resolve(res);
      });
    });

    expect(drives).toEqual(expect.arrayContaining(['/']));
    expect(drives).toEqual(expect.arrayContaining(['/Volumes/Macintosh HD', '/Volumes/External']));
    expect(drives).not.toEqual(expect.arrayContaining(['/Volumes/NotADir']));
  });

  test('falls back gracefully when /Volumes unreadable and still returns [/]', async () => {
    mockPlatformMac();
    mockFsPromises({ readdirError: Object.assign(new Error('EACCES'), { code: 'EACCES' }) });

    const drives = await new Promise<string[]>((resolve) => {
      jest.isolateModules(async () => {
        const mod = require('../src/extensions/gamemode_management/util/getDriveList');
        const res = await mod.default(api);
        resolve(res);
      });
    });

    expect(drives).toEqual(['/']);
    expect(api.showErrorNotification).not.toHaveBeenCalled();
  });
});