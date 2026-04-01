// Mock for vortex-api used by nmm-import-tool tests
export const fs = {
  statAsync: () => Promise.resolve({}),
};

export const util = {
  deriveInstallName: (input: string) => input,
};
