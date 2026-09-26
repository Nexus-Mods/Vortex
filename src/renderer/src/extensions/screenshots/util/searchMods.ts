import { getErrorMessageOrDefault } from "@vortex/shared";

import { getApplication } from "@/util/application";

interface IModsQueryResult {
  data?: {
    mods: { nodes: IModResult[] };
  };
  errors?: unknown[];
}

export interface IModResult {
  uid: string;
  adult: boolean;
  name: string;
  modId: number;
  thumbnailUrl: string;
  thumbnailBlurredUrl: string;
}

const MODS_QUERY = `
query mods(
  $filter: ModsFilter,
  $sort: [ModsSort!]
) {
  mods(
    filter: $filter,
    sort: $sort,
    count: 10
  ) {
    nodes {
      uid
      adult
      modId
      name
      thumbnailUrl
      thumbnailBlurredUrl
    }
  }
}`;

export default async function searchMods(
  query: string,
  gameDomain: string,
  token: string | undefined,
  showAdult: boolean,
  signal: AbortController["signal"],
): Promise<IModResult[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Application-Name": "Vortex",
    "Application-Version": getApplication().version,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const filter = {
    op: "AND",
    name: { value: query, op: "WILDCARD" },
    gameDomainName: { value: gameDomain, op: "EQUALS" },
    status: { value: "published", op: "EQUALS" },
    ...(showAdult ? {} : { adult: { value: false, op: "EQUALS" } }),
  };

  const sort = {
    endorsements: { direction: "DESC" },
  };

  try {
    const res = await fetch("https://api.nexusmods.com/v2/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: MODS_QUERY, variables: { filter, sort } }),
      signal,
    });
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Nexus Mods token has expired, please log out and back in.");
      throw new Error(`Mod search failed: ${res.status} ${res.statusText}`);
    }
    const json: IModsQueryResult = (await res.json()) as IModsQueryResult;
    if (json.errors || !json.data) throw new Error("Mod search failed with GraphQL errors");
    return json.data.mods.nodes;
  } catch (e: unknown) {
    window.api.log("warn", "Failed to search for mods", getErrorMessageOrDefault(e));
    throw e;
  }
}
