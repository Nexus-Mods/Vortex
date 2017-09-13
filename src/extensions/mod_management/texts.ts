import * as I18next from 'i18next';

function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'deployment':
      return t(
          'When you install a mod through Vortex it is stored in a separate directory and has ' +
          'no immediate effect on the game. We call the process of actually placing the ' +
          'files into the game directory "deployment".\n\n' +
          'By default, deployment happens automatically after you enable/disable a mod.\n' +
          'If you want more control you can disable this automation and will then have ' +
          'to manually click a button to start the deployment.\n\n' +
          'Please note that parts of Vortex (i.e. the list of plugins for TES games) will only ' +
          'reflect the "deployed" state.');
    case 'versionmatch':
      return t(
        'A dependency rule can accept multiple versions of the same mod. In that case any ' +
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
    case 'version':
      return t(
        'Version of the mod. Certain features are only available if the mod follows a ' +
        'standardized scheme called "semantic versioning" (see http://semver.org/) where a ' +
        'version consists of three numbers separated by dots like this: "1.2.0".\n' +
        'A warning here means that the version doesn\'t comply.\n\n' +
        'In semantic versioning the first number is the "major" version that gets incremented ' +
        'only on a big update that isn\'t compatible with previous versions so updating may ' +
        'break things (dependencies, save games).\n' +
        'Second number is called "minor" and incremented when new features were introduced.\n' +
        'Third number is called "patch" and gets increased if there were only bugfixes.\n' +
        'Thus "1.2.5" should definitively be more stable than "1.2.4". "1.3.0" should have all ' +
        'the bugfixes of "1.2.5" but it also adds features so there could be new bugs.\n' +
        'These dots are NOT decimal marks, version 1.10.0 is (much) newer than 1.3.0.');
    case 'source':
      return t(
        'The "Source" specifies where you got the mod. That source will be consulted for certain ' +
        'features, i.e. to find updates.\n\n' +
        'Only sources that are supported by Vortex can be selected.\n' +
        'If the mod was removed from the source it may make sense to select no source here to ' +
        'quiet error messages.');
    case 'paths': {
      return t(
        'Vortex uses defaults to store mods you download and install.\n'
        + 'If you don\'t like these defaults or can\'t use them (i.e. because you need to use '
        + 'the deployment method using hard link and the game is on a different drive) '
        + 'then use these settings to change the directories. Existing files will be '
        + 'moved to the new location automatically once you confirm the new paths.\n'
        + 'Please make sure you have write permission to the new directories.\n\n'
        + 'You can use "variables" to save yourself some typing:\n'
        + ' - {BASE} is replaced with the base path from the first box.\n'
        + ' - {GAME} is replaced with the id of the game\n'
        + ' - {USERDATA} is replaced with a platform dependent data directory that is guaranteed '
        + 'to have write access.\n'
        + '\n'
        + 'Example: If you only change the base path to "d:\\vortex\\{GAME}" and your active game '
        + 'is Skyrim then all your downloads will be located in "d:\\vortex\\skyrim\\downloads" '
        + 'and all your extracted mods will be in "d:\\vortex\\skyrim\\mods".');
    }
    default:
      return undefined;
  }
}

export default getText;
