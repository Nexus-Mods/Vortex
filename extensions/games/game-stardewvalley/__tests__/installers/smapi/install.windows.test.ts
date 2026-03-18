import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  installSMAPI,
  windowsSMAPIPlatform,
} from '../../../src/installers/smapi';
import {
  archiveFileEntries,
  smapiInstallerArchiveEntries,
  walkArchiveEntries,
  windowsInstallDatEntries,
} from './fixtures/archiveListings';
import {
  extractFullMock,
  fs,
  readFileAsyncMock,
  SevenZipMock,
  util,
  walkMock,
} from '../../../__mocks__/vortex-api';

describe('installers/smapi installSMAPI (windows)', () => {
  const normalizePathSeparators = (input: string) => input.replace(/\\/g, '/');

  beforeEach(() => {
    vi.clearAllMocks();
    readFileAsyncMock.mockResolvedValue('{"deps":true}');
    extractFullMock.mockResolvedValue(undefined);
  });

  test('uses real windows install.dat listing and extracts the Windows executable', async () => {
    const files = smapiInstallerArchiveEntries;
    const destinationPath = '/staging';

    walkMock.mockImplementation(async (_destination: string,
                                       cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>) => {
      await walkArchiveEntries(destinationPath, [...files, ...windowsInstallDatEntries], cb);
    });

    const result = await installSMAPI(() => '/game', files, destinationPath, windowsSMAPIPlatform);
    const copyInstructions = result.instructions.filter(instr => instr.type === 'copy');

    expect(SevenZipMock).toHaveBeenCalledTimes(1);
    expect(normalizePathSeparators(extractFullMock.mock.calls[0][0])).toBe('/staging/internal/windows/install.dat');
    expect(extractFullMock.mock.calls[0][1]).toBe('/staging');
    expect(copyInstructions).toHaveLength(archiveFileEntries(windowsInstallDatEntries).length);
    expect(copyInstructions.some(instr => instr.source === 'StardewModdingAPI.exe')).toBe(true);
    expect(copyInstructions.some(instr => instr.source === 'smapi-internal/config.json')).toBe(true);
    expect(copyInstructions.some(instr => typeof instr.source === 'string'
      && instr.source.startsWith('internal/windows/'))).toBe(false);
    expect(result.instructions.some(instr => instr.type === 'generatefile'
      && instr.destination === 'StardewModdingAPI.deps.json')).toBe(true);
    expect(normalizePathSeparators(fs.readFileAsync.mock.calls[0][0])).toBe('/game/Stardew Valley.deps.json');
    expect(fs.readFileAsync.mock.calls[0][1]).toEqual({ encoding: 'utf8' });
    expect(util.walk).toHaveBeenCalledTimes(1);
  });

  test('fails when windows executable is missing from extracted payload', async () => {
    const files = smapiInstallerArchiveEntries;
    const entriesWithoutExe = windowsInstallDatEntries.filter(entry => entry !== 'StardewModdingAPI.exe');

    walkMock.mockImplementation(async (_destination: string,
                                       cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>) => {
      await walkArchiveEntries('/staging', entriesWithoutExe, cb);
    });

    await expect(
      installSMAPI(() => '/game', files, '/staging', windowsSMAPIPlatform),
    ).rejects.toThrow('Failed to extract StardewModdingAPI.exe');
  });
});
