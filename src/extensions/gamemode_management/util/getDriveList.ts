import { IExtensionApi } from '../../../types/IExtensionContext';
import { isMacOS } from '../../../util/platform';

// Define the type for drivelist's list function
type DriveListFunc = () => Promise<Array<{
  isSystem: boolean;
  isRemovable: boolean;
  mountpoints?: Array<{ path: string }>;
  mountpoint?: string;
}>>;

function getDriveList(api: IExtensionApi): Promise<string[]> {
  // On macOS, use the mock implementation
  if (isMacOS()) {
    return Promise.resolve(['/']);
  }

  let list: DriveListFunc;
  try {
    // Dynamic import to avoid TypeScript errors when the module is not available
    const drivelist = require('drivelist');
    list = drivelist.list;
    if (typeof (list) !== 'function') {
      throw new Error('Failed to load "drivelist" module');
    }
  } catch (err) {
    api.showErrorNotification('Failed to query list of system drives',
      {
        message: 'Vortex was not able to query the operating system for the list of system drives. '
          + 'If this error persists, please configure the list manually.',
        error: err,
      }, { allowReport: false });
    return Promise.resolve(['C:']);
  }

  return list()
    .then(disks => disks
      .sort()
      .filter(disk => disk.isSystem && !disk.isRemovable)
      .reduce((prev, disk) => {
        if (disk.mountpoints) {
          prev.push(...disk.mountpoints.map(mp => mp.path));
        } else if (disk['mountpoint'] !== undefined) {
          prev.push(disk['mountpoint']);
        }
        return prev;
      }, []))
    .catch(err => {
      api.showErrorNotification(
        'Failed to determine list of disk drives. ' +
        'Please review the settings before scanning for games.',
        err, { allowReport: false });
      return ['C:'];
    });
}

export default getDriveList;
