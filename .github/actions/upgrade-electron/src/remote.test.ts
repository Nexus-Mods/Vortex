import { describe, expect, it } from "vitest";

import {
  type Fetch,
  fetchNodeAbiPackument,
  fetchReleases,
  NODE_ABI_URL,
  RELEASES_URL,
} from "./remote";

const respond =
  (body: unknown, status = 200): Fetch =>
  () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

describe("fetchReleases", () => {
  it("parses releases and drops unknown fields", async () => {
    const body = [
      {
        version: "45.1.0",
        node: "24.22.1",
        date: "2026-10-27",
        fullDate: "2026-10-27T16:01:01.000Z",
        v8: "x",
      },
      { version: "45.0.0", node: "24.22.0", date: "2026-10-21" },
    ];
    await expect(fetchReleases(respond(body))).resolves.toEqual([
      {
        version: "45.1.0",
        node: "24.22.1",
        date: "2026-10-27",
        fullDate: "2026-10-27T16:01:01.000Z",
      },
      { version: "45.0.0", node: "24.22.0", date: "2026-10-21" },
    ]);
  });

  it("requests the releases url", async () => {
    const urls: string[] = [];
    await fetchReleases((url) => {
      urls.push(url);
      return respond([])(url);
    });
    expect(urls).toEqual([RELEASES_URL]);
  });

  it("rejects an entry without a node version", async () => {
    await expect(
      fetchReleases(respond([{ version: "45.0.0", date: "2026-10-21" }])),
    ).rejects.toThrow(/node/u);
  });

  it("rejects a body that is not an array", async () => {
    await expect(fetchReleases(respond({}))).rejects.toThrow(/expected array/u);
  });

  it("fails on an http error", async () => {
    await expect(fetchReleases(respond([], 503))).rejects.toThrow(
      `GET ${RELEASES_URL} returned 503`,
    );
  });
});

describe("fetchNodeAbiPackument", () => {
  it("parses versions and publish times", async () => {
    const body = {
      name: "node-abi",
      versions: { "4.35.0": {} },
      time: { "4.35.0": "2026-01-01T00:00:00.000Z" },
    };
    await expect(fetchNodeAbiPackument(respond(body))).resolves.toEqual({
      versions: { "4.35.0": {} },
      time: { "4.35.0": "2026-01-01T00:00:00.000Z" },
    });
  });

  it("rejects a document without publish times", async () => {
    await expect(fetchNodeAbiPackument(respond({ versions: {} }))).rejects.toThrow(/time/u);
  });

  it("fails on an http error", async () => {
    await expect(fetchNodeAbiPackument(respond({}, 404))).rejects.toThrow(
      `GET ${NODE_ABI_URL} returned 404`,
    );
  });
});
