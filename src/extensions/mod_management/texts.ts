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
    case 'versionmatch':
      return t(
        'A dependency rule can reference multipe versions of the same mod. In that case any ' +
        'of the matching versions is enough to satisfy the dependency. This can be useful ' +
        'for example if two mods have the same dependency but one of them doesn\'t work with ' +
        'the most current one. In that case we can install an older version of the dependency ' +
        'that works for both.\n\n' +
        'For details on how version ranges are specified you can google for "semver ranges" ' +
        'but the most common forms are:\n' +
        ' - ">=1.2.3" means: All versions newer than or equal to 1.2.3\n' +
        ' - "1.2.3 - 1.4.2" means: All versions between and including 1.2.3 and 1.4.2\n' +
        ' - "^1.2.3" means: All versions >= 1.2.3 but < 2.0.0 (not including 2.0.0!)\n' +
        ' - "1.2.x" means: All versions >= 1.2.0 and < 1.3.0');
    case 'namematch':
      return t(
        'To be able to match multiple versions of the same file we need a way to identify a set ' +
        'of related files. When the author provides a common name across all versions we use ' +
        'that, but in this case we need to work with expression matching.\n\n' +
        'This uses a so called "glob pattern". If you used dos or linux you probably know them:\n' +
        'Use ? to stand in for any single character and * for any number of any ' +
        'character. So if your file name is "SkyUI_5_1-3863-5-1" you can change that to ' +
        '"SkyUI_*-3863-*" and it should match any version of SkyUI (The 3863 part is the mod ' +
        'id on Nexus so it should always be the same).');
    default:
      return undefined;
  }
}

export default getText;
