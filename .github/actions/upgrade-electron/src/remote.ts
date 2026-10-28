import { type ZodType } from "zod";

import { electronReleasesSchema, npmPackumentSchema } from "./schemas";
import { type ElectronRelease, type NpmPackument } from "./schemas";

export const RELEASES_URL = "https://releases.electronjs.org/releases.json";
export const NODE_ABI_URL = "https://registry.npmjs.org/node-abi";

/** Subset of `fetch` used here, so tests can stub the network. */
export type Fetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** GETs `url` and validates the JSON body against `schema`. */
export const fetchJson = async <T>(
  url: string,
  schema: ZodType<T>,
  fetchFn: Fetch = fetch,
): Promise<T> => {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  return schema.parse(await response.json());
};

/** All Electron releases. */
export const fetchReleases = (fetchFn?: Fetch): Promise<ElectronRelease[]> =>
  fetchJson(RELEASES_URL, electronReleasesSchema, fetchFn);

/** The npm registry document of node-abi. */
export const fetchNodeAbiPackument = (fetchFn?: Fetch): Promise<NpmPackument> =>
  fetchJson(NODE_ABI_URL, npmPackumentSchema, fetchFn);
