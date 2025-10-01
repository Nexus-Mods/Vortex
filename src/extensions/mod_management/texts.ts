import { TFunction } from '../../util/i18n';

function getText(id: string, t: TFunction) {
  switch (id) {
    case 'deployment':
      return t(
        'When you install a mod through Vortex it is stored in a separate directory and has ' +
          'no immediate effect on the game. We call the process of actually placing the ' +
          'files into the game directory "deployment".\n\n' +
          'There are different methods available in Vortex to do this Deployment, the best ' +
          'one will usually get picked automatically, based on which game you\'re modding ' +
          'and your system configuration.\n' +
          'All methods have in common that deployment is way quicker than copying files and ' +
          'consumes no or very little additional disk space.\n\n' +
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
        'Version of the mod. A warning here means that the mod doesn\'t follow the recognized ' +
        'versioning standard but that just means Vortex may not be able to provide some ' +
        'of the more advanced features or they are slightly less convenient to use.\n\n' +
        'Vortex supports "semantic versioning" (see http://semver.org/) where a ' +
        'version consists of three numbers separated by dots like this: "1.2.0".\n' +
        'In semantic versioning the first number is the "major" version that gets incremented ' +
        'only on a big update that isn\'t compatible with previous versions so updating may ' +
        'break things (dependencies, save games).\n' +
        'Second number is called "minor" and gets incremented when new features were ' +
        'introduced.\n' +
        'Third number is called "patch" and gets increased if there were only bugfixes.\n' +
        'Thus "1.2.5" should definitively be more stable than "1.2.4". "1.3.0" should have all ' +
        'the bugfixes of "1.2.x" so far but it also adds features so there could be new bugs.\n' +
        'These dots are NOT decimal marks, version 1.10.0 is (much) newer than 1.3.0.');
    case 'archivename':
      return t(
        'The file name of the archive which was used to install this mod. If this field is ' +
        'empty, the mod is no longer paired with an archive, probably because the archive was ' +
        'deleted.');
    case 'variant':
      return t(
        'If you have multiple copies of the same mod installed ' +
        '(e.g. with different settings made) ' +
        'they will be merged into one line on the mod list between which you can toggle. ' +
        'Use the variant field to distinguish between them. E.g. you could have a ' +
        '"1k" and a "2k" variant of a mod installed.',
      );
    case 'source':
      return t(
        'The "Source" specifies where you got the mod. That source will be consulted for certain ' +
        'features, i.e. to find updates.\n\n' +
        'Only sources that are supported by Vortex can be selected.\n' +
        'If the mod was removed from the source it may make sense to select no source here to ' +
        'quiet error messages.');
    case 'downloadspath': {
      return t(
        'The downloads folder holds all mod archives you have downloaded with Vortex. It is shared across all '
        + 'games and includes a subfolder for each of them. e.g. if your downloads folder is set to\n'
        + '"D:\\Vortex Downloads\\", archive files for Skyrim will be stored in: "D:\\Vortex Downloads\\skyrim\\".\n'
        + 'By default Vortex will select a user data directory that is guaranteed to have write access.\n'
        + 'When changing the Downloads Folder, the downloads for all your games will be moved to the new location '
        + 'automatically. Make sure the new location has plenty of available space and that you have permission '
        + 'to write files to it.\n'
        + 'You can use "variables" to save yourself some typing:\n'
        + ' - {USERDATA} is replaced with your user data directory.\n'
        + 'e.g. if your Windows account name is Mike,'
        + '\n "{USERDATA}\\Downloads\\" will be converted to:\n'
        + '"C:\\Users\\Mike\\AppData\\Roaming\\Vortex\\Downloads\\"');
    }
    case 'modspath': {
      return t(
        'Vortex uses default paths to store mods you download and install.\n'
        + 'If you don\'t like these defaults or can\'t use them (i.e. because you need to use '
        + 'the hard link deployment method and the game is on a different drive) '
        + 'then use this input box to change the directories. Existing files will be '
        + 'moved to the new location automatically once you confirm the new paths.\n'
        + 'Please make sure you have write permission to the new directories. Do NOT use your '
        + 'Vortex application directory!\n\n'
        + 'You can use "variables" to save yourself some typing:\n'
        + ' - {GAME} is replaced with the id of the game\n'
        + ' - {USERDATA} is replaced with a platform dependent data directory that is guaranteed '
        + 'to have write access.\n'
        + '\n'
        + 'Example: If you change the path to "d:\\vortex_mods\\{GAME}" and your active '
        + 'game is Skyrim then all your extracted mods will be in '
        + '"d:\\vortex_mods\\skyrim".');
    }
    case 'conflicts': {
      return t(
        'A file conflict happens every time two mods contain the same file so one mod has to overwrite the other. '
        + 'This is a very common occurrence in modding.\n\n'
        + 'When installing mods manually or through NMM you\'re asked during mod installation whether to '
        + 'overwrite files or not but with Vortex you make that choice after the installation and you can change '
        + 'your choice at any time without reinstalling the mod.\n\n'
        + 'You still need to choose though, otherwise files you deploy may be incompatible and the game '
        + 'could become unstable or have all sorts of errors.\n\n'
        + 'If you don\'t know which order to use, look for instructions by the mod authors. If the instruction you get '
        + 'says \'Install mod x after mod y\' this translates to a mod rule of \'mod x loads after mod y\'.\n\n'
        + 'If you can\'t find any information, a good rule of thumb is: Load the newest mod (the one released last) after '
        + 'the older one.');
    }
    default:
      return undefined;
  }
}

export default getText;
