export function convertMOVersion(input: string): string {
  return input.replace(/^[df]/, '');
}

export function guessMOVersion(fileName: string, modId: string): string {
  // As long as the mod has been downloaded from NexusMods
  //  we can resolve the mod's version from the archive's filename.
  //  this is more reliable than using the meta.ini file given that
  //  MO appends zeroes to mod versions inside the ini file.
  const pattern = new RegExp(`(?<=${modId}-)(.*)-\\d{10}`, 'i');
  const match = fileName.match(pattern);
  if (match === null) {
    return undefined;
  } else {
    return match[1].replace(/-/g, '.');
  }
}
