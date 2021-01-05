import { list as listT } from 'drivelist';
import { IExtensionApi } from '../../../types/IExtensionContext';

function getDriveList(api: IExtensionApi): Promise<string[]> {
  let list: typeof listT;
  try {
    list = require('drivelist').list;
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
