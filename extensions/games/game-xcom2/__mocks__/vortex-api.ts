import { vi } from "vitest";

export const fs = {
  ensureDirWritableAsync: vi.fn(() => Promise.resolve()),
  ensureDirAsync: vi.fn(() => Promise.resolve()),
  readdirAsync: vi.fn(() => Promise.resolve([])),
  statAsync: vi.fn(() => Promise.resolve({ isDirectory: () => true })),
  readFileAsync: vi.fn(() => Promise.resolve("")),
  writeFileAsync: vi.fn(() => Promise.resolve()),
};

export const log = vi.fn();

export class ProcessCanceled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessCanceled";
  }
}

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataInvalid";
  }
}

export const util = {
  getSafe: vi.fn((_state: unknown, _path: string[], fallback: unknown) => fallback),
  GameStoreHelper: {
    findByAppId: vi.fn(() => Promise.resolve({ gamePath: "C:\\Games\\XCOM2" })),
  },
  ProcessCanceled,
  DataInvalid,
  getManifest: vi.fn(() => Promise.resolve({ files: [] })),
};

export const types = {};
