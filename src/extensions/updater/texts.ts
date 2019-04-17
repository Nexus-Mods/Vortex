import I18next from 'i18next';

function getText(id: string, t: I18next.TFunction) {
  switch (id) {
    case 'update-channel': return t(
      'You can choose to either receive automatic updates only after they went through some '
      + 'community testing (Stable) or to always get the newest features (Testing).');
    default: return undefined;
  }
}

export default getText;
