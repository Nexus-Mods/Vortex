export const DELETE = 0x00010000;
export const READ_CONTROL = 0x000200000;
export const WRITE_DAC = 0x00040000;
export const WRITE_OWNER = 0x00080000;
export const SYNCHRONIZE = 0x00100000;

export const STANDARD_RIGHTS_REQUIRED = 0x000F0000;
export const STANDARD_RIGHTS_READ = 0x000200000;
export const STANDARD_RIGHTS_WRITE = 0x000200000;
export const STANDARD_RIGHTS_EXECUTE = 0x000200000;
export const STANDARD_RIGHTS_ALL = 0x001F0000;

export const SPECIFIC_RIGHTS_ALL = 0x0000FFFF;

export const GENERIC_ALL = 0x10000000;
export const GENERIC_EXECUTE = 0x20000000;
export const GENERIC_WRITE = 0x40000000;
export const GENERIC_READ = 0x80000000;

export function Grant(permissions, name);
export function ApplyAccess(filePath, access);
