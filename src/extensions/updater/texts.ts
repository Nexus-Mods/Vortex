import * as I18next from 'i18next';
import * as path from 'path';

function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'update-channel': return t(
      'You can choose to either receive automatic updates only after they went through some '
      + 'community testing (Stable) or to always get the newest features (Beta).');
    default: return undefined;
  }
}

export default getText;
