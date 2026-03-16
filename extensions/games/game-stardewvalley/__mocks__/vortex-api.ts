export const readFileAsyncMock = jest.fn();
export const extractFullMock = jest.fn();
export const walkMock = jest.fn();
export const SevenZipMock = jest.fn(() => ({
  extractFull: extractFullMock,
}));

export const fs = {
  readFileAsync: readFileAsyncMock,
};

export const log = jest.fn();

export class DataInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataInvalid';
  }
}

export const util = {
  DataInvalid,
  SevenZip: SevenZipMock,
  walk: walkMock,
};
