import type { Chunk } from "./chunking";

export type Resolver<T> = (resource: T) => Promise<ResolvedResource>;

export type ResolvedResource =
  | URL
  | { probeUrl: URL; chunkUrl?: (chunk: Chunk) => Promise<URL> };

export const urlResolver: Resolver<URL> = (url) => Promise.resolve(url);

export type NormalizedResource = {
  probeUrl: URL;
  chunkUrl: (chunk: Chunk) => Promise<URL>;
};

export function normalize(resource: ResolvedResource): NormalizedResource {
  if (resource instanceof URL) {
    return {
      probeUrl: resource,
      chunkUrl: () => Promise.resolve(resource),
    };
  }

  const { probeUrl, chunkUrl } = resource;
  return {
    probeUrl,
    chunkUrl: chunkUrl ?? (() => Promise.resolve(probeUrl)),
  };
}
