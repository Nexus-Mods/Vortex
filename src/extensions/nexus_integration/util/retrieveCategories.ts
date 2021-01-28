import { log } from '../../../util/log';

import { ICategoryDictionary } from '../../category_management/types/ICategoryDictionary';

import NexusT, { IModCategory } from '@nexusmods/nexus-api';

interface IGameInfo {
  categories: IModCategory[];
}

/**
 * retrieve the categories by the server call
 *
 * @param {string} activeGameId
 * @param {NexusT} nexus
 * @return {ICategoryDictionary} res
 *
 */
function retrieveCategoryList(
  activeGameId: string,
  nexus: NexusT,
): Promise<ICategoryDictionary> {
  return new Promise<ICategoryDictionary>((resolve, reject) => {
    nexus.getGameInfo(activeGameId)
      .then((gameInfo: IGameInfo) => {
        if (gameInfo.categories !== undefined) {
          const res: ICategoryDictionary = {};
          let counter: number = 1;

          gameInfo.categories.forEach((category: IModCategory) => {
            const parent = category.parent_category === false
              ? undefined
              : category.parent_category.toString();

            res[category.category_id.toString()] = {
              name: category.name,
              parentCategory: parent,
              order: counter,
            };
            ++counter;
          });

          resolve(res);
        }
      },
    )
      .catch((err) => {
        log('error', 'Failed to retrieve game information', { err: err.message });
        reject(err);
      });
  });
}

export default retrieveCategoryList;
