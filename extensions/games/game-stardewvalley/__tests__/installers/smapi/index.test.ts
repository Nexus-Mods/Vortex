import {
  isSMAPIModType,
  linuxSMAPIPlatform,
  macosSMAPIPlatform,
  resolveSMAPIPlatform,
  windowsSMAPIPlatform,
} from '../../../src/installers/smapi';

describe('installers/smapi platform resolution', () => {
  test('returns windows variant for win32', () => {
    expect(resolveSMAPIPlatform('win32')).toBe(windowsSMAPIPlatform);
    expect(resolveSMAPIPlatform('win32').executableName).toBe('StardewModdingAPI.exe');
  });

  test('returns linux variant for linux', () => {
    expect(resolveSMAPIPlatform('linux')).toBe(linuxSMAPIPlatform);
    expect(resolveSMAPIPlatform('linux').executableName).toBe('StardewModdingAPI');
  });

  test('returns macOS stub variant for darwin', () => {
    const resolved = resolveSMAPIPlatform('darwin');
    expect(resolved).toBe(macosSMAPIPlatform);
    expect(resolved.implemented).toBe(false);
  });

  test('throws for unknown platforms', () => {
    expect(() => resolveSMAPIPlatform('plan9' as NodeJS.Platform))
      .toThrow('Unsupported platform for SMAPI installer');
  });
});

describe('installers/smapi isSMAPIModType', () => {
  test('matches windows executable instructions from extracted install.dat payload', async () => {
    const instructions = [
      { type: 'copy', source: 'StardewModdingAPI.exe' },
    ] as any;

    await expect(isSMAPIModType(instructions, windowsSMAPIPlatform)).resolves.toBe(true);
  });

  test('matches linux executable instructions from extracted install.dat payload', async () => {
    const instructions = [
      { type: 'copy', source: 'StardewModdingAPI' },
    ] as any;

    await expect(isSMAPIModType(instructions, linuxSMAPIPlatform)).resolves.toBe(true);
  });

  test('does not match instructions for a different platform executable', async () => {
    const instructions = [
      { type: 'copy', source: 'internal/windows/StardewModdingAPI.exe' },
    ] as any;

    await expect(isSMAPIModType(instructions, linuxSMAPIPlatform)).resolves.toBe(false);
  });
});
