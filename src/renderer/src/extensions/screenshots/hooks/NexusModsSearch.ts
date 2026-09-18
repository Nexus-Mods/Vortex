import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { getAccessToken } from "@/extensions/nexus_integration/util/oauthSession";
import type { IExtensionApi, IState } from "@/types/api";
import { getGame, nexusGameId } from "@/util/api";
import { activeGameId } from "@/util/selectors";

import type { IModResult } from "../util/searchMods";
import searchMods from "../util/searchMods";

interface INexusModsSearchOptions {
  debounceDelayMs: number;
  tryToUseLogin?: boolean;
}

export default function useNexusModsSearch(
  query: string,
  api: IExtensionApi,
  options: INexusModsSearchOptions = { debounceDelayMs: 500 },
) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<IModResult[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const { domainName } = useSelector((state: IState) => {
    const gameId = activeGameId(state);
    const game = getGame(gameId);
    const domainName = nexusGameId(game);
    return {
      domainName,
    };
  });

  const adultContentFilter: boolean = useSelector(
    (state: IState) => state.persistent["nexus"]?.userInfo?.adult ?? false,
  );

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
    const controller = new AbortController();
    setIsLoading(true);
    setIsError(false);

    void (async () => {
      try {
        const token = tryToUseLogin ? await getAccessToken(api) : undefined;
        const r = await searchMods(
          debouncedQuery,
          domainName,
          token,
          adultContentFilter,
          controller.signal,
        );
        if (!controller.signal.aborted) setResults(r);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e as Error);
          setIsError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, tryToUseLogin, domainName, api]);

  return {
    isLoading,
    isError,
    error,
    results,
  };
}
