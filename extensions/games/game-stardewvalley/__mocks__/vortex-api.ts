import { vi } from "vitest";

export const readFileAsyncMock = vi.fn();
export const extractFullMock = vi.fn();
export const walkMock = vi.fn();
export const SevenZipMock = vi.fn(
  class SevenZipMock {
    public extractFull = extractFullMock;
  },
);

export const fs = {
  readFileAsync: readFileAsyncMock,
};

export const log = vi.fn();

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataInvalid";
  }
}

export const util = {
  DataInvalid,
  SevenZip: SevenZipMock,
  walk: walkMock,
};
