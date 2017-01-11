
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

interface ICategoryDic {
  [id: string]: { name: string, parentCategory: string };
};

export function retriveCategoryList(
  activeGameId: string,
  nexus: Nexus
): any {
  return new Promise<any>((resolve, reject) => {
    nexus.getGameInfo(activeGameId)
      .then((gameInfo: IGameInfo) => {
        if (gameInfo.categories !== undefined) {
          let categoryList: any[] = [];
          gameInfo.categories.forEach(category => {

            let categoryDict: ICategoryDic = {
              [category.category_id]:
              {
                name: category.name, parentCategory: category.parent_category === false
                  ? undefined : category.parent_category.toString(),
              },
            };

            categoryList.push(categoryDict);
          });

          let categories = categoryList.reduce((result, item) => {
            let key = Object.keys(item)[0];
            result[key] = item[key];
            return result;
          }, {});

          resolve(categories);
        }
      }
      )
      .catch((err) => {
        log('error', 'An error occurred retrieving the Game Info', { err: err.message });
        reject(err);
      });
  });
}
