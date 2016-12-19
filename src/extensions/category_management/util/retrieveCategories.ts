import { IExtensionContext } from '../../../types/IExtensionContext';

import { log } from '../../../util/log';
import Nexus from 'nexus-api';

import { ICategory } from '../types/ICategory';
import { ICategoryTree, IChildren } from '../types/ICategoryTree';
import { IGameListEntry } from '../types/IGameListEntry';

interface IGameInfo extends IGameListEntry {
  categories: ICategory[];
}

let nexus: Nexus;

export function retriveCategoryList(
  activeGameId: string,
  nexus: Nexus,
  isUpdate: boolean
): any {
  return new Promise<any>((resolve, reject) => {
    let categoryList = [];
    nexus.getGameInfo(activeGameId)
      .then((gameInfo: IGameInfo) => {

        let roots = gameInfo.categories.filter((value) => value.parent_category === false);
        roots.forEach(rootElement => {
          let children: ICategory[] = gameInfo.categories.filter((value) =>
            value.parent_category === rootElement.category_id);
          let childrenList = [];

          children.forEach(element => {
            let child: IChildren = {
              rootId: element.category_id,
              title: element.name, expanded: false,
            };
            childrenList.push(child);
          });

          let root: ICategoryTree = {
            rootId: rootElement.category_id,
            title: rootElement.name,
            expanded: false,
            children: childrenList,
          };
          categoryList.push(root);
        });

        resolve(categoryList);
      }
      )
      .catch((err) => {
        log('error', 'An error occurred retrieving the Game Info', { err: err.message });
        return null;
      });
  });
}
