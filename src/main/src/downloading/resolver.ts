import type { Chunk, Resolver, ResolvedEndpoint, ResolvedResource } from "@vortex/shared/download";

export const urlResolver: Resolver<URL> = (url) => Promise.resolve({ url });

/** @internal */
export type NormalizedResource = {
  probeEndpoint: ResolvedEndpoint;
  chunkEndpoint: (chunk: Chunk) => Promise<ResolvedEndpoint>;
};

/** @internal */
export function normalize(resource: ResolvedResource): NormalizedResource {
  if ("url" in resource) {
    return {
      probeEndpoint: resource,
      chunkEndpoint: () => Promise.resolve(resource),
    };
  }

  const { probeEndpoint, chunkEndpoint } = resource;
  return {
    probeEndpoint,
    chunkEndpoint: chunkEndpoint ?? (() => Promise.resolve(probeEndpoint)),
  };
}
