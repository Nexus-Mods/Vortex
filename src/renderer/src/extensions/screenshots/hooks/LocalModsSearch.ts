import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

export default function useLocalModsSearch(query: string) {
  const gameId = useSelector(activeGameId);
  const mods = useSelector((s: IState) => s.persistent.mods[gameId]);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => {
      clearTimeout(timerId);
    };
  }, [query]);

  const results: IMod[] = useMemo(() => {
    if (!debouncedQuery || !mods) return [];
    const q = debouncedQuery.toLowerCase();
    return Object.values(mods)
      .filter((mod) => {
        if (mod.type === "collection") return false;
        const { name, modName, fileName, logicalFileName, customFileName } = mod.attributes;
        return [name, modName, fileName, logicalFileName, customFileName].some((v) =>
          v?.toLowerCase().includes(q),
        );
      })
      .sort(
        (a, b) =>
          new Date(b.attributes?.installTime).getTime() -
          new Date(a.attributes?.installTime).getTime(),
      );
  }, [debouncedQuery, mods]);

  return {
    results,
  };
}
