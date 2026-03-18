import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  installSMAPI,
  linuxSMAPIPlatform,
} from '../../../src/installers/smapi';
import {
  archiveFileEntries,
  smapiInstallerArchiveEntries,
  walkArchiveEntries,
  linuxInstallDatEntries,
} from './fixtures/archiveListings';
import {
  extractFullMock,
  readFileAsyncMock,
  SevenZipMock,
  walkMock,
} from '../../../__mocks__/vortex-api';

describe('installers/smapi installSMAPI (linux)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileAsyncMock.mockResolvedValue('{"deps":true}');
    extractFullMock.mockResolvedValue(undefined);
  });

  test('uses real linux install.dat listing and extracts the Linux executable', async () => {
    const files = smapiInstallerArchiveEntries;

    walkMock.mockImplementation(async (_destination: string,
                                       cb: (iter: string, stats: { isFile: () => boolean }) => Promise<void>) => {
      await walkArchiveEntries('/staging', linuxInstallDatEntries, cb);
    });

    const result = await installSMAPI(() => '/game', files, '/staging', linuxSMAPIPlatform);
    const copyInstructions = result.instructions.filter(instr => instr.type === 'copy');

    expect(SevenZipMock).toHaveBeenCalledTimes(1);
    expect(extractFullMock).toHaveBeenCalledWith('/staging/internal/linux/install.dat', '/staging');
    expect(copyInstructions).toHaveLength(archiveFileEntries(linuxInstallDatEntries).length);
    expect(copyInstructions.some(instr => instr.source === 'StardewModdingAPI')).toBe(true);
    expect(copyInstructions.some(instr => instr.source === 'smapi-internal/config.json')).toBe(true);
    expect(copyInstructions.some(instr => typeof instr.source === 'string'
      && instr.source.startsWith('internal/linux/'))).toBe(false);
    expect(result.instructions.some(instr => instr.type === 'generatefile'
      && instr.destination === 'StardewModdingAPI.deps.json')).toBe(true);
  });

  test('fails when platform data archive is missing', async () => {
    const files = smapiInstallerArchiveEntries
      .filter(file => file !== 'internal/linux/install.dat');

    await expect(
      installSMAPI(() => '/game', files, '/staging', linuxSMAPIPlatform),
    ).rejects.toThrow('Failed to find the SMAPI data files');
  });
});
