import type NexusT from "@nexusmods/nexus-api";

/**
 * mkeiitmods: runs a hand-written GraphQL query through the existing Nexus API client.
 *
 * `@nexusmods/nexus-api` only exposes typed wrappers for the queries Vortex needs and has
 * no mod search. Going through the client rather than a separate `fetch` keeps everything
 * it does for every request: the shared rate-limit quota and back-off, OAuth/API-key
 * auth with token refresh, and our Application-Name/Version headers.
 *
 * The members used here are private in the library's typings, so they are reached through
 * this narrow interface. If an update to the library renames them, `queryGraph` throws a
 * clear error instead of misbehaving.
 */
interface INexusGraphInternals {
  mQuota?: { wait(): Promise<void> };
  mGraphBaseURL?: string;
  args?(custom: Record<string, unknown>): { data?: unknown };
  request?(url: string, args: unknown, method: string): Promise<IGraphResponse>;
}

interface IGraphResponse {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message?: string }>;
}

export class GraphQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQueryError";
  }
}

export async function queryGraph<T>(
  nexus: NexusT,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const client = nexus as unknown as INexusGraphInternals;
  if (
    typeof client.request !== "function" ||
    typeof client.args !== "function" ||
    typeof client.mGraphBaseURL !== "string"
  ) {
    throw new GraphQueryError("The Nexus API client does not support raw GraphQL queries");
  }

  await client.mQuota?.wait();
  const args = client.args({});
  args.data = { query, variables };
  const res = await client.request(client.mGraphBaseURL, args, "POST");

  if (res?.errors !== undefined && res.errors.length > 0) {
    throw new GraphQueryError(res.errors.map((err) => err.message ?? "unknown error").join("; "));
  }
  if (res?.data === undefined || res.data === null) {
    throw new GraphQueryError("Empty response from the Nexus Mods API");
  }
  return res.data as T;
}
