import type NexusT from "@nexusmods/nexus-api";
import { describe, expect, it, vi } from "vitest";

import { GraphQueryError, queryGraph } from "./rawGraphQuery";

function fakeNexus(response: unknown) {
  const request = vi.fn(async () => response);
  const wait = vi.fn(async () => undefined);
  const nexus = {
    mQuota: { wait },
    mGraphBaseURL: "https://api.nexusmods.com/v2/graphql",
    args: () => ({ headers: { "Application-Name": "mkeiitmods" } }),
    request,
  } as unknown as NexusT;
  return { nexus, request, wait };
}

describe("queryGraph", () => {
  it("posts the query through the client and returns the data", async () => {
    const { nexus, request, wait } = fakeNexus({ data: { mods: { totalCount: 1 } } });
    const res = await queryGraph<{ mods: { totalCount: number } }>(nexus, "query { x }", {
      a: 1,
    });
    expect(res.mods.totalCount).toBe(1);
    expect(wait).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      "https://api.nexusmods.com/v2/graphql",
      {
        headers: { "Application-Name": "mkeiitmods" },
        data: { query: "query { x }", variables: { a: 1 } },
      },
      "POST",
    );
  });

  it("turns GraphQL errors into an exception", async () => {
    const { nexus } = fakeNexus({ data: null, errors: [{ message: "bad filter" }] });
    await expect(queryGraph(nexus, "query { x }", {})).rejects.toThrow("bad filter");
  });

  it("fails clearly if the client no longer has the members it relies on", async () => {
    await expect(queryGraph({} as NexusT, "query { x }", {})).rejects.toBeInstanceOf(
      GraphQueryError,
    );
  });
});
