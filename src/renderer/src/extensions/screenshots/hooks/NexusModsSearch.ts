import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/api";
import { getGame, nexusGameId } from "@/util/api";
import { activeGameId } from "@/util/selectors";

import type { IModResult } from "../util/searchMods";
import searchMods from "../util/searchMods";

interface INexusModsSearchOptions {
  debounceDelayMs: number;
  tryToUseLogin?: boolean;
}

type IStateWithCredentials = IState & {
  confidential: { account: { nexus?: { OAuthCredentials?: { token: string } } } };
};

export default function useNexusModsSearch(
  query: string,
  options: INexusModsSearchOptions = { debounceDelayMs: 500 },
) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<IModResult[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const { OAuthCredentials, domainName } = useSelector((state: IStateWithCredentials) => {
    const gameId = activeGameId(state);
    const game = getGame(gameId);
    const domainName = nexusGameId(game);
    return {
      gameId,
      domainName,
      OAuthCredentials: state.confidential.account.nexus?.OAuthCredentials,
    };
  });

  const { debounceDelayMs, tryToUseLogin } = options;

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceDelayMs);
    return () => {
      clearTimeout(timerId);
    };
  }, [query, debounceDelayMs]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    void searchMods(debouncedQuery, domainName, tryToUseLogin ? OAuthCredentials : undefined)
      .then((r) => setResults(r))
      .catch((e) => {
        setError(e as Error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }, [debouncedQuery, OAuthCredentials, tryToUseLogin, domainName]);

  return {
    isLoading,
    isError,
    error,
    results,
  };
}
