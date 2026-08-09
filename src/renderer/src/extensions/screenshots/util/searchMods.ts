import { getApplication } from "../../../util/application";

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
    count: 5
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
}
Variables`;

export default async function searchMods(
  query: string,
  gameDomain: string,
  loginSession?: { token: string },
): Promise<IModResult[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Application-Name": "Vortex",
    "Application-Version": getApplication().version,
  };
  if (loginSession && loginSession.token) headers["Authorization"] = `Bearer ${loginSession.token}`;

  const filter = {
    op: "AND",
    nameStemmed: { value: query, op: "WILDCARD" },
    gameDomainName: { value: gameDomain, op: "EQUALS" },
    status: { value: "published", op: "EQUALS" },
  };

  try {
    const res = await fetch("https://api.nexusmods.com/v2/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: MODS_QUERY, variables: { filter } }),
    });
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Nexus Mods token has expired, please log out and back in.");
      throw new Error(`Mod search failed: ${res.status} ${res.statusText}`);
    }
    const json: IModsQueryResult = (await res.json()) as IModsQueryResult;
    console.log("Mod search res", json, filter);
    if (json.errors || !json.data) throw new Error("Mod search failed with Graph QL errors");
    return json.data.mods.nodes;
  } catch (e: unknown) {
    console.log(e);
    throw e;
  }
}
