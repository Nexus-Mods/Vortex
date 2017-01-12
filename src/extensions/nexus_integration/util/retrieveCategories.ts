
import { log } from '../../../util/log';

import Nexus, {ICategory} from 'nexus-api';

interface IGameInfo {
  categories: ICategory[];
}

export interface ICategoryDict {
  [id: string]: { name: string, parentCategory: string };
};

function retrieveCategoryList(
  activeGameId: string,
  nexus: Nexus
): Promise<ICategoryDict> {
  return new Promise<ICategoryDict>((resolve, reject) => {
    nexus.getGameInfo(activeGameId)
      .then((gameInfo: IGameInfo) => {
        if (gameInfo.categories !== undefined) {
          let res: ICategoryDict = {};

          gameInfo.categories.forEach((category: ICategory) => {
            let parent = category.parent_category === false
              ? undefined
              : category.parent_category.toString();

            res[category.category_id.toString()] = {
              name: category.name,
              parentCategory: parent,
            };
          });

          resolve(res);
        }
      }
      )
      .catch((err) => {
        log('error', 'An error occurred retrieving the Game Info', { err: err.message });
        reject(err);
      });
  });
}

export default retrieveCategoryList;
