
import { log } from '../../../util/log';

import Nexus from 'nexus-api';

interface IGameInfo {
  categories: ICategory[];
}

interface ICategory {
    category_id: number;
    name: string;
    parent_category: number | false;
}

interface IChildren {
  rootId: number;
  title: string;
  expanded: boolean;
}

interface ICategoryTree {
  rootId: number;
  title: string;
  expanded: boolean;
  children: IChildren[];
}

export function retriveCategoryList(
  activeGameId: string,
  nexus: Nexus
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
        throw err;
      });
  });
}
