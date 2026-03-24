/**
 * Shared `vortex-api` mock for the SMAPI tests.
 *
 * Import this file before `./index` so the mock is ready before the installer
 * code loads.
 */
import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

type VortexFsMock = {
  readFileAsync: MockFn;
};

type VortexUtilMock = {
  DataInvalid: typeof DataInvalid;
  SevenZip: MockFn;
  walk: MockFn;
};

/**
 * Spy for `SevenZip#extractFull`.
 */
export const extractFullMock: MockFn = vi.fn();

/**
 * Spy for `vortex-api.log`.
 */
export const logMock: MockFn = vi.fn();

/**
 * Spy for `vortex-api.fs.readFileAsync`.
 */
export const readFileAsyncMock: MockFn = vi.fn();

/**
 * Spy for `vortex-api.util.walk`.
 */
export const walkMock: MockFn = vi.fn();

/**
 * Simple `DataInvalid` error for tests.
 */
export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataInvalid";
  }
}

/**
 * Mock `SevenZip` constructor used by the tests.
 */
export const SevenZipMock: MockFn = vi.fn(
  class SevenZipMock {
    public extractFull = extractFullMock;
  },
);

/**
 * Mocked `vortex-api.fs` export.
 */
export const fs: VortexFsMock = {
  readFileAsync: readFileAsyncMock,
};

/**
 * Mocked `vortex-api.log` export.
 */
export const log: MockFn = logMock;

/**
 * Mocked `vortex-api.util` export.
 */
export const util: VortexUtilMock = {
  DataInvalid,
  SevenZip: SevenZipMock,
  walk: walkMock,
};

/**
 * Clears the shared spies and restores the default success behavior.
 */
export function resetVortexApiMocks(): void {
  vi.clearAllMocks();
  readFileAsyncMock.mockResolvedValue('{"deps":true}');
  extractFullMock.mockResolvedValue(undefined);
}

// Tell Vitest to use these shared test doubles for every `vortex-api` import.
// The empty `__mocks__/vortex-api.ts` file only exists so the alias resolves.
vi.mock(import("vortex-api"), () => ({ fs, log, util }) as any);
