import CategoryList from './views/CategoryList';

import { IExtensionContext } from '../../types/IExtensionContext';
import { loadCategories } from './actions/category';

import { ICategory } from './types/ICategory';
import { IGameListEntry } from './types/IGameListEntry';

import { categoryReducer } from './reducers/category';

import { ICategoryTree, IChildren } from './types/ICategoryTree';

import { getSafe } from '../../util/storeHelper';

import Nexus from 'nexus-api';

import {log} from '../../util/log';

interface IGameInfo extends IGameListEntry {
  categories: ICategory[];
}

let nexus: Nexus;

function init(context: IExtensionContext): boolean {
  context.registerMainPage('book', 'Categories', CategoryList, {
    hotkey: 'C',
  });

  context.registerReducer(['persistent'], categoryReducer);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    try {
      let state = context.api.store.getState();
      nexus = new Nexus(
        getSafe(state, ['settings', 'gameMode', 'current'], ''),
        getSafe(state, ['account', 'nexus', 'APIKey'], '')
      );

      const activeGameId = store.getState().settings.gameMode.current;

      nexus.getGameInfo(activeGameId)
        .then((gameInfo: IGameInfo) => {
          let categories = [];

          let roots = gameInfo.categories.filter((value) => value.parent_category === false);
          roots.forEach(rootElement => {
            let children: ICategory[] = gameInfo.categories.filter((value) =>
              value.parent_category === rootElement.category_id);
            let childrenList = [];

            children.forEach(element => {
              let child: IChildren = { rootId: element.category_id,
                 title: element.name, expanded: false  };
              childrenList.push(child);
            });

            let root: ICategoryTree = {
              rootId: rootElement.category_id,
              title: rootElement.name,
              expanded: false,
              children: childrenList,
            };
            categories.push(root);
          });

          context.api.store.dispatch(loadCategories(activeGameId, categories));
        });
    } catch (err) {
      log('error', 'Failed to load categories', err);
    }
  });

  return true;
}

export default init;
