import { log } from "../../../util/log";

import type { ICategoryDictionary } from "../../category_management/types/ICategoryDictionary";

import type { IModCategory } from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";

interface IGameInfo {
  categories: IModCategory[];
}

function hasLoop(categories: ICategoryDictionary, category: string): boolean {
  const visited: string[] = [];

  let iter = category;
  while (iter !== undefined && categories[iter] !== undefined) {
    if (visited.includes(iter)) {
      return true;
    }

    visited.push(iter);
    iter = categories[iter].parentCategory;
  }

  return false;
}

function fixLoops(dict: ICategoryDictionary) {
  Object.keys(dict).forEach((key) => {
    if (hasLoop(dict, key)) {
      dict[key].parentCategory = undefined;
    }
  });
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
    nexus
      .getGameInfo(activeGameId)
      .then((gameInfo: IGameInfo) => {
        if (gameInfo.categories !== undefined) {
          const res: ICategoryDictionary = {};
          let counter: number = 1;

          gameInfo.categories.forEach((category: IModCategory) => {
            const parent =
              category.parent_category === false
                ? undefined
                : category.parent_category.toString();

            res[category.category_id.toString()] = {
              name: category.name,
              parentCategory: parent,
              order: counter,
            };
            ++counter;
          });

          fixLoops(res);
          return resolve(res);
        }
      })
      .catch((err) => {
        log("error", "Failed to retrieve game information", {
          err: getErrorMessageOrDefault(err),
        });
        reject(err);
      });
  });
}

export default retrieveCategoryList;
