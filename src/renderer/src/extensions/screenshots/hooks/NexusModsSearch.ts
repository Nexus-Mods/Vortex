import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import { getAccessToken } from "@/extensions/nexus_integration/util/oauthSession";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
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
  const gameId = useSelector(activeGameId);
  const domainName = useMemo(() => nexusGameId(getGame(gameId)), [gameId]);

  interface INexusModsAccountSlice {
    userInfo?: { adult?: boolean };
  }

  const adultContentFilter: boolean = useSelector(
    (state: IState) =>
      (state.persistent["nexus"] as INexusModsAccountSlice)?.userInfo?.adult ?? false,
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
        const showAdult = tryToUseLogin ? adultContentFilter : false;
        const r = await searchMods(debouncedQuery, domainName, token, showAdult, controller.signal);
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
  }, [debouncedQuery, tryToUseLogin, domainName, api, adultContentFilter]);

  return {
    isLoading,
    isError,
    error,
    results,
  };
}
