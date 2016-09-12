import i18n = require('i18next');
import FSBackend = require('i18next-node-fs-backend');

i18n
  .use(FSBackend)
  .init({
    fallbackLng: 'en',

    ns: ['common'],
    defaultNS: 'common',

    debug: true,

    saveMissing: false,

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: `${__dirname}/../locales/{{lng}}/{{ns}}.json`,
      addPath: `${__dirname}/../locales/{{lng}}/{{ns}}.missing.json`,
    },
  });

export default i18n;
