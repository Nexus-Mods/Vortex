import chromePath from './util/chromePath';

import Promise from 'bluebird';
import { TFunction } from 'i18next';

function getText(id: string, t: TFunction): string {
  switch (id) {
    case 'chrome-fix': return t(
      'Chrome requires a change to a configuration file to allow an external program to handle '
      + 'links where chrome doesn\'t know the protocol. As of chrome 77 this also allows '
      + 'This is the case for the "Download with Manager" buttons on Nexus.\n\n'
      + 'We can apply this change for you, but only if all instances of Chrome are closed, '
      + 'otherwise it will look like it worked but the change is reset when chrome closes.\n\n'
      + 'To clarify: we\'re only enabling support for nxm:// links as used on nexusmods, '
      + 'we\'re not changing anything else.\n');
    default: return undefined;
  }
}

export default getText;
