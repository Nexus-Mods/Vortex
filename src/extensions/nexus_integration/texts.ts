import chromePath from './util/chromePath';

import { remote } from 'electron';
import * as I18next from 'i18next';
import * as path from 'path';

function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'apikey':
      return t(
        'Instead of entering your username and password for login you need to enter '
        + 'an API-Key that you can generate on the nexusmods page website. Such keys '
        + 'can also be used for other applications using nexus features. The key '
        + 'identifies you and the application it\'s intended for.\n\n'
        + 'Apart from this being more secure, it gives you and us more control:\n'
        + '- you only ever type your password on nexusmods\n'
        + '- If someone steals your api key they can\'t log in to the page and can\'t change '
        + 'your email or password\n'
        + '- You can delete/disable an api key without affecting your login or other api keys\n'
        + '- You can change your password without having to update it anywhere outside the page.\n'
        + '- If an application is malicious or spams the page with requests, affecting '
        + 'other users, we can identify the application as the offender, instead of seeing '
        + 'just the ips/accounts responsible for the traffic.\n\n'
        + 'For this reason, please always use keys in the applications they were intended for.');
    case 'chrome-fix': return t(
      'Chrome requires a change to a configuration file to allow an external program to handle '
      + 'links where chrome doesn\'t know the protocol. This is the case for the green "Download '
      + 'with Manager" buttons on Nexus.\n\n'
      + 'We can apply this change for you, but only if all instances of Chrome are closed, '
      + 'otherwise it will look like it worked but the change is reset when chrome closes.\n\n'
      + 'To clarify: we\'re only enabling support for nxm:// links as used on nexusmods, '
      + 'we\'re not changing anything else.\n\n'
      + 'If you\'d rather do this manually close Chrome, open the file '
      + chromePath()
      + ', find the section "exclude_schemes" below "protocol_handlers" and add\n'
      + '"nxm": false,\n'
      + 'below the line \'"nntp": true,\'. Make sure you don\'t break the format of the file, '
      + 'it will not accept any incorrect or missing symbols anywhere.');
    default: return undefined;
  }
}

export default getText;
