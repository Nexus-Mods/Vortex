import type { IGameInfo, IModCategory } from "@nexusmods/nexus-api";
import { useCallback, useState } from "react";
import { useSelector, useStore } from "react-redux";

import { updateCategories } from "@/actions";
import { log } from "@/logging";
import type { IState } from "@/types/api";
import { getApplication, getGame, nexusGameId } from "@/util/api";
import { activeGameId } from "@/util/selectors";

import type { ICategoryDictionary } from "../types/ICategoryDictionary";

const GameV1URL = (domainName: string) => `https://api.nexusmods.com/v1/games/${domainName}.json`;

async function getCategories(
  domainName: string,
  token: string,
): Promise<IModCategory[] | undefined> {
  // This could be outsourced to a library, but it's unclear how
  try {
    const url = GameV1URL(domainName);
    const headers = {
      Accept: "application/json",
      "Application-Name": "Vortex",
      "Application-Version": getApplication().version,
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}`);
    const game: IGameInfo = (await res.json()) as IGameInfo;
    return game.categories;
  } catch (e: unknown) {
    log("warn", "Failed to get categories for game", e);
    if ((e as Error).message === "Failed to fetch")
      throw new Error("An unexpcted network error occurred.", { cause: e });
    throw e;
  }
}

type IStateWithCreds = IState & {
  confidential: {
    account: { nexus: { OAuthCredentials: { token: string; refreshToken: string } } };
  };
};

export default function useCategoriesFromNexusMods() {
  const store = useStore();
  const [error, setError] = useState<{ title: string; detail: string } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

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
      setIsLoading(true);
      setIsError(false);
      if (!OAuthCredentials.token) return;
      try {
        const newCategories = await getCategories(domainName, OAuthCredentials.token);
        const categoryMap: ICategoryDictionary = createDictionaryFromList(newCategories);
        if (!replaceAll) {
          // Try and preserve existing custom categories.
          const keysToSave = Object.keys(categories).filter(
            (k) => isNaN(Number(k)) || Number(k) > 1000,
          );
          keysToSave.forEach((k) => (categoryMap[k] = categories[k]));
        }
        return store.dispatch(updateCategories(gameId, categoryMap));
      } catch (e: unknown) {
        const err = e as Error;
        setIsError(true);
        setError({ title: "Failed to fetch categories from Nexus Mods", detail: err.message });
      } finally {
        setIsLoading(false);
      }
    },
    [OAuthCredentials, domainName, gameId, store, categories],
  );

  const clearError = () => {
    setIsError(false);
    setError(undefined);
  };

  return { fetchCategoriesForGame, error, isLoading, isError, clearError };
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
