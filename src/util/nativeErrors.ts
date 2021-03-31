export interface IDecoded {
  title: string;
  message: string;
  rethrowAs: string;
}

export function decodeSystemError(err: Error, filePath: string): IDecoded {
  const code = err['systemCode'] ?? err['nativeCode'];

  if ((code === undefined) || (process.platform !== 'win32')) {
    return undefined;
  }

  if (code === 225) {
    return {
      title: 'Anti Virus denied access',
      message: 'Your Anti-Virus Software has blocked access to "{{filePath}}".',
      rethrowAs: 'EBUSY',
    };
  } else if ([21, 59, 67, 483, 793, 1005, 1006,
              1127, 1392, 1920, 6800].includes(code)) {
    return {
      title: `I/O Error (${code})`,
      message: 'Accessing "{{filePath}}" failed with an error that indicates '
        + 'a hardware problem. This may indicate the disk is defective, '
        + 'if it\'s a network or cloud drive it may simply indicate '
        + 'temporary network or server problems. '
        + 'Please do not report this to us, this is not a bug in Vortex '
        + 'and we can not provide remote assistance with hardware problems.',
      rethrowAs: 'ENOENT',
    };
  } else if ([1336].includes(code)) {
    return {
      title: `I/O Error (${code})`,
      message: 'Accessing "{{filePath}} failed with an error that indicates '
        + 'file system corruption. If this isn\'t a temporary problem '
        + 'you may want to run chkdsk or similar software to check for problems. '
        + 'It may also help to reinstall the software that this file belongs to.',
      rethrowAs: 'EIO',
    };
  } else if ([362, 383, 388, 390, 395, 396, 404].includes(code)
      || ((code === 1359) && (filePath ?? '').toLowerCase().includes('onedrive'))) {
    return {
      title: `OneDrive error (${code})`,
      message: 'The file "{{filePath}}" is stored on a cloud storage drive '
        + '(Microsoft OneDrive) which is currently unavailable. Please '
        + 'check your internet connection and verify the service is running, '
        + 'then retry.',
      rethrowAs: 'ENOENT',
    };
  } else if ([4390, 4393, 4394].includes(code)) {
    return {
      title: `Incompatible folder (${code})`,
      message: 'Windows reported an error message regarding "{{filePath}}" that indicates '
        + 'the containing folder has limitations that make it unsuitable for what '
        + 'it\'s being used. '
        + 'A common example of this is if you try to put the staging folder on a '
        + 'OneDrive folder because OneDrive can\'t deal with hardlinks.',
      rethrowAs: 'EIO',
    };
  } else if ([433, 1920].includes(code)) {
    return {
      title: `Drive unavailable (${code})`,
      message: 'The file "{{filePath}}" is currently not accessible. If this is a '
        + 'network drive, please make sure it\'s connected. Otherwise make sure '
        + 'the drive letter hasn\'t changed and if necessary, update the path '
        + 'within Vortex.',
      rethrowAs: 'ENOENT',
    };
  } else if ([53, 55, 4350].includes(code)) {
    return {
      title: `Network drive unavailable (${code})`,
      message: 'The file "{{filePath}}" is currently not accessible, very possibly the '
        + 'network share as a whole is inaccesible due to a network problem '
        + 'or the server being offline.',
      rethrowAs: 'ENOENT',
    };
  } else if (code === 1816) {
    return {
      title: 'Not enough quota',
      message: 'Windows reported insufficient quota writing to "{{filePath}}".',
      rethrowAs: 'EIO',
    };
  } else if (code === 6851) {
    return {
      title: 'Volume dirty',
      message: 'The operation could not be completed because the volume is dirty. '
             + 'Please run chkdsk and try again.',
      rethrowAs: 'EIO',
    };
  } else if (code === 1359) {
    return {
      title: 'Internal error',
      message: 'The operation failed with an internal (internal to windows) error. '
      + 'No further error information is available to us.',
      rethrowAs: 'EIO',
    };
  } else {
    return {
      title: `${err.message} (${code})`,
      message: 'The operation failed with an unknown windows error code.',
      rethrowAs: 'UNKNOWN',
    };
  }
}
