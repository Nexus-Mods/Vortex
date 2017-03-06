function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'deployment':
      return t(
          'When you install a mod through NMM2 it is stored in a separate directory and has ' +
          'no immediate effect on the game. We call the process of actually placing the ' +
          'files into the game directory "deployment".\n\n' +
          'By default, deployment happens the moment you enable/disable a mod.\n' +
          'If you want more control you can disable this automation and you will then have ' +
          'to manually click a button to start the deployment.\n\n' +
          'Please note that parts of NMM2 will reflect the "deployed" state so they will ' +
          'not be up-to-date until you deploy.');
    default:
      return undefined;
  }
}

export default getText;
