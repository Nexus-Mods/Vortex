import chromePath from './util/chromePath';

import * as Promise from 'bluebird';
import I18next from 'i18next';

function getText(id: string, t: I18next.TFunction): Promise<string> {
  switch (id) {
    case 'chrome-fix': return chromePath()
      .catch(() => '%LOCALAPPDATA%\\Google\\Chrome\\User Data')
      .then(resolvedPath => t(
      'Chrome requires a change to a configuration file to allow an external program to handle '
      + 'links where chrome doesn\'t know the protocol. This is the case for the green "Download '
      + 'with Manager" buttons on Nexus.\n\n'
      + 'We can apply this change for you, but only if all instances of Chrome are closed, '
      + 'otherwise it will look like it worked but the change is reset when chrome closes.\n\n'
      + 'To clarify: we\'re only enabling support for nxm:// links as used on nexusmods, '
      + 'we\'re not changing anything else.\n\n'
      + 'If you\'d rather do this manually close Chrome, open the file '
      + resolvedPath
      + ', find the section "exclude_schemes" below "protocol_handlers" and add\n'
      + '"nxm": false,\n'
      + 'below the line \'"nntp": true,\'. Make sure you don\'t break the format of the file, '
      + 'it will not accept any incorrect or missing symbols anywhere.'));
    default: return undefined;
  }
}

export default getText;
