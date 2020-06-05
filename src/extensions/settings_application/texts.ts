import { TFunction } from 'i18next';

function getText(id: string, t: TFunction) {
  switch (id) {
    case 'multi-user': return t(
      'By default, every user account on your system has its own "instance" ' +
      'of Vortex with their own settings, mods, profiles and so on.' +
      '\n\n' +
      'If you want to share these things between all users of your PC, you can toggle to ' +
      '"Shared" mode. In this mode all data will be stored in a global location ' +
      'and available to all users on this system.' +
      '\n\n' +
      'Please note that this includes login credentials for Nexus Mods and ' +
      'other, potentially confidential, pieces of information you enter in Vortex.' +
      '\n\n' +
      'This switch is not destructive. The data stored with your user account is ' +
      'not touched while you\'re in shared mode, so you can toggle back and forth.');
  }
}

export default getText;
