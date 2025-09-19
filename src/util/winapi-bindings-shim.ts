/**
 * Shim for winapi-bindings module on non-Windows platforms
 * This provides stub implementations that throw appropriate errors
 * when Windows-specific functionality is attempted on other platforms.
 */

const createUnsupportedError = (functionName: string) => {
  return new Error(`${functionName} is only supported on Windows platforms`);
};

export const WritePrivateProfileString = (
  section: string,
  key: string | null,
  value: string | null,
  filePath: string
): boolean => {
  throw createUnsupportedError('WritePrivateProfileString');
};

export const GetPrivateProfileSectionNames = (filePath: string): string[] => {
  throw createUnsupportedError('GetPrivateProfileSectionNames');
};

export const GetPrivateProfileSection = (
  section: string,
  filePath: string
): { [key: string]: string } => {
  throw createUnsupportedError('GetPrivateProfileSection');
};

export const SetProcessPreferredUILanguages = (flags: number, languages: string[]): boolean => {
  throw createUnsupportedError('SetProcessPreferredUILanguages');
};

// Export all functions as default export to match winapi-bindings structure
export default {
  WritePrivateProfileString,
  GetPrivateProfileSectionNames,
  GetPrivateProfileSection,
  SetProcessPreferredUILanguages,
};