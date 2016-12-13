//var SegfaultHandler = require('segfault-handler');
//SegfaultHandler.registerHandler('crash.log');

let nbind = require('nbind');

//const MASTERLIST_PATH = 'C:\\Users\\Tannin\\AppData\\Local\\LOOT\\Skyrim Special Edition\\masterlist.yaml';
//const REPO_URL = 'https://github.com/loot/skyrimse.git';

const MASTERLIST_PATH = 'C:\\Users\\Tannin\\AppData\\Local\\LOOT\\Skyrim\\masterlist.yaml';
const REPO_URL = 'https://github.com/loot/skyrim.git';

let lib = nbind.init().lib;

setTimeout(() => {
  let loot = new lib.Loot(
      'skyrim',
      'd:\\Steam Games\\SteamApps\\common\\skyrim',
      'C:\\Users\\Tannin\\AppData\\Local\\Skyrim');
  /*
  let loot = new lib.Loot(
      'skyrimse',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Skyrim Special Edition',
      'C:\\Users\\Tannin\\AppData\\Local\\Skyrim Special Edition');
      */
  let info = loot.getMasterlistRevision(MASTERLIST_PATH, false);
  console.log('Masterlist info before', info.revisionId);

  loot.updateMasterlist(MASTERLIST_PATH, REPO_URL, 'v0.10',
      (err, res) => {
        console.log('masterlist updated', err, res);
        info = loot.getMasterlistRevision(MASTERLIST_PATH, false);
        console.log('Masterlist info after', info.revisionId);

        loot.loadLists(MASTERLIST_PATH, '', (err) => {
          console.log('lists loaded', err);
          loot.evalLists((err) => {
            console.log('Lists evaluated', err);
            loot.getPluginMessages('InfernoStormShout.esp', 'en')
            .forEach((msg) => {
              console.log('message: ', msg.text);
            });
            console.log('cleanliness', loot.getPluginCleanliness('Update.esm'));
            let tags = loot.getPluginTags('Update.esm');
            console.log('tags added', tags.added);
            console.log('tags removed', tags.removed);
            console.log('sorted', loot.sortPlugins(['Update.esm', 'Skyrim.esm']));
          });
        });
      });
}, 1);
