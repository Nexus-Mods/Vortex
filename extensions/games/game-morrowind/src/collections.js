const { actions, selectors, util } = require('vortex-api');
const { MORROWIND_ID, NATIVE_PLUGINS } = require('./constants');
const { deserializeLoadOrder, serializeLoadOrder } = require('./loadorder');

async function genCollectionsData(context,
                                  gameId,
                                  includedMods,
                                  collection) {
  if (MORROWIND_ID !== gameId) {
    return Promise.resolve([]);
  }
  try {
    const state = context.api.getState();
    const mods = util.getSafe(state, ['persistent', 'mods', gameId], {});
    const included = includedMods.reduce((accum, iter) => {
      if (mods[iter] !== undefined) {
        accum[iter] = mods[iter];
      }
      return accum;
    }, {});
    const loadOrder = await deserializeLoadOrder(context.api, included);
    const filtered = loadOrder.filter(entry => (NATIVE_PLUGINS.includes(entry.id) || entry.modId !== undefined));
    return Promise.resolve({ loadOrder: filtered });
  } catch (err) {
    return Promise.reject(err);
  }
}

async function parseCollectionsData(context,
                                    gameId,
                                    data) {
  if (MORROWIND_ID !== gameId) {
    return Promise.resolve();
  }
  try {
    await serializeLoadOrder(context.api, data.loadOrder);
  } catch (err) {
    return Promise.reject(err);
  }
}

module.exports = {
  parseCollectionsData,
  genCollectionsData,
}