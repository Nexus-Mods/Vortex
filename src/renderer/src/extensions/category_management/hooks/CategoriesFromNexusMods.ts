import type { IGameInfo, IModCategory } from "@nexusmods/nexus-api";
import { useCallback, useContext } from "react";
import { useSelector, useStore } from "react-redux";

import { updateCategories } from "@/actions";
import { MainContext } from "@/contexts";
import { log } from "@/logging";
import type { IState } from "@/types/api";
import { getApplication, getGame, nexusGameId } from "@/util/api";
import { activeGameId } from "@/util/selectors";

import type { ICategoryDictionary } from "../types/ICategoryDictionary";

const GameV1URL = (domainName: string) => `api.nexusmods.com/v1/games/${domainName}.json`;

async function getCategories(
  domainName: string,
  token: string,
): Promise<IModCategory[] | undefined> {
  // This could be outsourced to a library, but it's unclear how
  try {
    const res = await fetch(GameV1URL(domainName), {
      headers: {
        Accept: "application/json",
        "Application-Name": "Vortex",
        "Application-Version": getApplication().version,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
    const game: IGameInfo = (await res.json()) as IGameInfo;
    return game.categories;
  } catch (e: unknown) {
    log("warn", "Failed to get categories for game", e);
    return undefined;
  }
}

type IStateWithCreds = IState & {
  confidential: {
    account: { nexus: { OAuthCredentials: { token: string; refreshToken: string } } };
  };
};

export default function useCategoriesFromNexusMods() {
  const context = useContext(MainContext);
  const store = useStore();

  const { OAuthCredentials, domainName, gameId, categories } = useSelector(
    (state: IStateWithCreds) => {
      const gameId = activeGameId(state);
      const game = getGame(gameId);
      const domainName = nexusGameId(game);
      return {
        OAuthCredentials: state.confidential.account.nexus.OAuthCredentials,
        domainName,
        gameId,
        categories: state.persistent.categories?.[gameId] || {},
      };
    },
  );

  const fetchCategoriesForGame = useCallback(
    async (replaceAll: boolean = false) => {
      if (!OAuthCredentials.token) return;
      const newCategories = await getCategories(domainName, OAuthCredentials.token);
      const categoryMap: ICategoryDictionary = createDictionaryFromList(newCategories);
      if (!replaceAll) {
        // Try and preserve existing categories.
        const keysToSave = Object.keys(categories).filter((k) => isNaN(Number(k)));
        keysToSave.forEach((k) => (categoryMap[k] = categories[k]));
      }
      return store.dispatch(updateCategories(gameId, categoryMap));
    },
    [OAuthCredentials, domainName, gameId, store, categories],
  );

  // context.api.events.emit("update-categories", gameId, categories, isUpdate);

  return {};
}

function createDictionaryFromList(list: IModCategory[]): ICategoryDictionary {
  const dict = {};
  let counter = 1;
  list.forEach((category) => {
    const parent =
      category.parent_category === false ? undefined : category.parent_category.toString();
    dict[String(category.category_id)] = {
      name: category.name,
      parentCategory: parent,
      order: counter,
    };
    counter++;
  });

  return dict;
}
