const path = require('path');
const semver = require('semver');
const Promise = require('bluebird');
const { fs, log, selectors, util } = require('vortex-api');

const GAME_ID = 'dragonsdogma';
const I18N_NAMESPACE = `game-${GAME_ID}`;

const ROM_CONTENTS = [
  'dl1', 'enemy', 'eq', 'etc', 'event', 'gui', 'h_enemy', 'ingamemanual', 'item_b',
  'map', 'message', 'mnpc', 'npc', 'npcfca', 'npcfsm', 'om', 'pwnmsg', 'quest', 'shell',
  'sk', 'sound', 'stage', 'voice', 'wp', 'bbs_rpg.arc', 'bbsrpg_core.arc', 'game_main.arc',
  'Initialize.arc', 'title.arc',
];

function findGame() {
  return util.steam.findByName('Dragon\'s Dogma: Dark Arisen')
    .then(game => game.gamePath);
}

function modPath() {
  return path.join('nativePC');
}

function prepareForModding(discovery, context) {
  return fs.ensureDirAsync(path.join(discovery.path, modPath()));
}

function walkAsync(dir) {
  let entries = [];
  return fs.readdirAsync(dir).then(files => {
    return Promise.each(files, file => {
      const fullPath = path.join(dir, file);
      return fs.statAsync(fullPath).then(stats => {
        if (stats.isDirectory()) {
          entries.push(fullPath);
          return walkAsync(fullPath)
            .then(nestedFiles => {
              entries = entries.concat(nestedFiles);
              return Promise.resolve();
            })
        } else {
          entries.push(fullPath);
          return Promise.resolve();
        }
      });
    });
  })
  .then(() => Promise.resolve(entries))
  .catch(err => {
    log('error', 'Unable to read mod directory', err);
    return Promise.resolve(entries);
  });
}

function migrate101(api, oldVersion) {
  // This migration is required due to an errorneous commit which was intended
  //  to fix https://github.com/Nexus-Mods/Vortex/issues/2954 but ended up making
  //  things much worse, without actually fixing the initial bug which was due to
  //  an incorrectly packed mod. The commit functions as a hacky workaround instead,
  //  which explains why we had not been aware of this until now. The commit in question is:
  //  (https://github.com/Nexus-Mods/vortex-games/commit/ef725134db1c861c31ec533bae2166f29458ced8)
  //
  //  Although the commit would indeed work fine for 99% of DDDA mods as the mod files
  //  are usually located within the "rom" directory and nowhere else - any mod which had
  //  consisted of required files positioned outside the "rom" directory would
  //  install into the staging folder with missing files.
  //
  //  This migration intends to attempt to fix the issue by migrating existing mods in staging into
  //  ../rom/ directory so the user can still deploy non-faulty mods correctly, while
  //  informing him that he may be required to re-install mods which do not seem to behave as expected.
  if (semver.gte(oldVersion, '1.0.1')) {
    return Promise.resolve();
  }

  const state = api.store.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const hasMods = Object.keys(mods).length > 0;

  if (!hasMods) {
    // no mods, no problem.
    return Promise.resolve();
  }

  const raiseDDDANotif = (migratedModsSuccess) => {
    const needReinstallMsg = api.translate((migratedModsSuccess)
      ? 'Mods for Dragon\'s Dogma may need to be reinstalled'
      : 'Mods for Dragon\'s Dogma NEED to be reinstalled', { ns: I18N_NAMESPACE });
    const pleaseNote = (migratedModsSuccess)
      ? api.translate('Please note: if you are happy with your current mod setup, and have not noticed any issues, '
        + 'it is perfectly possible that you are not affected and shouldn\'t feel forced to re-install, but should '
        + 'keep an eye out for weird behaviour.\n\n', { ns: I18N_NAMESPACE })
      : api.translate('Please note: Vortex had attempted to automatically migrate your mods to the new '
        + 'mod format and has failed - you MUST re-install all your mods.\n\n', { ns: I18N_NAMESPACE });
    api.sendNotification({
      id: 'dragons-dogma-upgrade',
      type: (migratedModsSuccess) ? 'warning' : 'error',
      message: needReinstallMsg,
      noDismiss: true,
      actions: [
        {
          title: 'Explain',
          action: () => {
            api.showDialog('info', 'Dragon\'s Dogma', {
              text: api.translate('It was raised to our attention that certain DDDA mods are not being '
                  + 'installed correctly through Vortex. This due to an error in our installer\'s '
                  + 'logic which ignored all mod files positioned outside the "../nativePC/rom/" directory.\n\n'
                  + 'This unfortunately means that the mods installed within the staging folder could potentially '
                  + 'be missing files - these mods will not function correctly unless they are re-installed.\n\n'
                  + `{{pleasenote}}`
                  + 'We are sorry for the inconvenience.', { replace: { pleasenote: pleaseNote }, ns: I18N_NAMESPACE }),
            }, [
              { label: 'Close' },
            ]);
          },
        },
        {
          title: 'Understood',
          action: dismiss => {
            dismiss();
          }
        }
      ],
    });
  }

  let migrationSuccess = true;

  // The user has pre-existing mods - let the nightmare begin.
  const installPath = selectors.installPathForGame(state, GAME_ID);
  return Promise.each(Object.keys(mods), key => {
    const modEntry = mods[key];
    const modPath = path.join(installPath, modEntry.installationPath);
    return walkAsync(modPath).then(entries => {
      const isRomDir = entries.find(entry => {
        const relPath = path.relative(modPath, entry);
        const segments = relPath.split(path.sep).filter(seg => !!seg);
        return (ROM_CONTENTS.includes(segments[0]));
      }) !== undefined;

      const newRomDir = path.join(modPath, 'rom');

      return (isRomDir)
        ? fs.ensureDirAsync(newRomDir).then(() =>
          Promise.reduce(entries, (accum, file) => {
            const segs = file.split(path.sep).filter(seg => !!seg);
            if (path.extname(segs[segs.length - 1]) !== '') {
              accum['files'] = [].concat(accum['files'] || [], file);
            } else {
              accum['dirs'] = [].concat(accum['dirs'] || [], file);
            }
            return accum;
          }, {})).then(filtered => Promise.each(filtered.files, file => {
            const relPath = path.relative(modPath, file);
            const newFilePath = path.join(modPath, 'rom', relPath);

            return fs.moveAsync(file, newFilePath);
          }).then(() => {
            if (filtered.dirs !== undefined) {
              const sorted = filtered.dirs.sort((a, b) => b.length - a.length);
              return Promise.each(sorted, dir => fs.removeAsync(dir));
            }
          })).catch(err => {
            log('error', 'migration failed', err);
            migrationSuccess = false
            return Promise.resolve();
          })
        : Promise.resolve(); // Not a rom dir ? nothing to do here.
    });
  })
  .then(() => {
    raiseDDDANotif(migrationSuccess);
    Promise.resolve();
  });
}

// merging archives is considerably slower than replacing them, if we did it for all arc files,
// deployment can take several minutes even with just a handful of mods. Thus we have to be
// picky regarding which archives it actually makes sense to merge. So the question is:
// is it likely multiple mods will try to edit the same archive *and* work alongside each other
// if merged. E.g. texture/mesh replacers affecting the same armor wouldn't.
// I further found that merging bbsrpg_core.arc somehow breaks the number one mod on the site,
// haven't figured out why yet.
const mergeNames = [ 'game_main.arc', 'title.arc'/*, 'bbsrpg_core.arc', 'bbs_rpg.arc'*/ ];

function main(context) {
  context.requireExtension('mtframework-arc-support');

  context.registerGame({
    id: GAME_ID,
    name: 'Dragon\'s Dogma',
    mergeMods: true,
    mergeArchive: filePath => mergeNames.includes(path.basename(filePath.toLowerCase())),
    queryPath: findGame,
    queryModPath: modPath,
    logo: 'gameart.jpg',
    executable: () => 'DDDA.exe',
    requiredFiles: [
      'DDDA.exe',
    ],
    setup: (discovery) => prepareForModding(discovery, context),
    environment: {
      SteamAPPId: '367500',
    },
    details: {
      steamAppId: 367500,
      // in dragons dogma the data archives are commonly replaced or modified during modding
      // so using any of those for determining the game version might be problematic
      hashFiles: [
        'DDDA.exe',
      ],
    },
  });

  context.registerMigration(old => migrate101(context.api, old));
  context.registerInstaller('dddainvalidmod', 25, testIsInvalidMod, (...args) => reportInvalidMod(context, ...args));

  return true;
}

function reportInvalidMod(context, files, destinationPath, gameId, progressDelegate, choices, unattended, archivePath) {
  const invalidModDialog = () => new Promise((resolve, reject) => {
    if (unattended) {
      return resolve();
    }

    context.api.showDialog('question', 'Invalid archive', {
      text: 'The archive "{{archiveName}}" does not fit the expected packaging pattern '
        + 'for this game, and probably will not install correctly. Are you sure you want '
        + 'to proceed?',
      parameters: {
        archiveName: archivePath !== undefined ? path.basename(archivePath) : '',
      }
    }, [
      { label: 'Cancel', action: () => reject(new util.UserCanceled()) },
      { label: 'Proceed', action: () => resolve() },
    ]);
  });

  return invalidModDialog()
    .then(() => {
      const instructions = files.filter(file => path.extname(file) !== '').map(file => ({
        type: 'copy',
        source: file,
        destination: file,
      }))

      return Promise.resolve({ instructions });
    });
}

function testIsInvalidMod(files, gameId) {
  return (gameId !== GAME_ID)
    ? Promise.resolve({ supported: false })
    : Promise.resolve({ supported: (files.filter(file => {
        const segments = file.split(path.sep).filter(seg => !!seg);
        return segments.find(seg => ['movie', 'rom', 'sa', 'sound', 'system', 'tgs',
          'usershader', 'usertexture'].includes(seg)) !== undefined;
    }).length === 0)
  });
}

module.exports = {
  default: main,
};
