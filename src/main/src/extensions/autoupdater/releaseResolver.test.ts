import { readFileSync } from "node:fs";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GithubReleaseLite } from "./releaseResolver";
import {
  _resetCacheForTests,
  classifyUpdate,
  pickRelease,
  RateLimitError,
  repoForChannel,
  resolveUpdate,
  shouldAutoDownload,
} from "./releaseResolver";

vi.mock("../../logging", () => ({ log: vi.fn() }));

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "__fixtures__", "releases.json"), "utf8"),
) as GithubReleaseLite[];

function release(overrides: Partial<GithubReleaseLite>): GithubReleaseLite {
  return {
    tag_name: "v1.0.0",
    draft: false,
    prerelease: false,
    assets: [{ name: "latest.yml" }, { name: "vortex-setup-1.0.0.exe" }],
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const status = init.status ?? 200;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (status === 304) {
    // Response's constructor rejects null-body statuses like 304.
    const headers = new Headers(init.headers ?? {});
    return { status, ok: false, headers, text: () => Promise.resolve("") } as unknown as Response;
  }
  return new Response(text, { status, headers: init.headers ?? {} });
}

afterEach(() => {
  _resetCacheForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("pickRelease", () => {
  // Regression pin for the shipped bug: electron-updater 4.6.5 walked the
  // atom feed by publish date, so beta users on 2.5.0-beta.2 were offered the
  // older stable 2.4.2 (published later) as an "update" — a bogus downgrade.
  it("picks max semver per channel from date-interleaved releases", () => {
    expect(pickRelease(fixture, "stable")?.tag_name).toBe("v2.5.0");
    expect(pickRelease(fixture, "beta")?.tag_name).toBe("v2.6.0-beta.1");
    expect(classifyUpdate("2.5.0-beta.2", "2.5.0", { switchToStable: false })).toBe("upgrade");
  });

  it("prefers a newer stable over an older beta on the beta channel", () => {
    const subset = fixture.filter((entry) => ["v2.5.0", "v2.5.0-beta.2"].includes(entry.tag_name));
    expect(pickRelease(subset, "beta")?.tag_name).toBe("v2.5.0");
  });

  it("excludes drafts even when they are max semver", () => {
    const withDraft = [release({ tag_name: "v9.9.9", draft: true }), ...fixture];
    expect(pickRelease(withDraft, "stable")?.tag_name).toBe("v2.5.0");
    expect(pickRelease(withDraft, "beta")?.tag_name).toBe("v2.6.0-beta.1");
  });

  it("excludes releases whose prerelease flag disagrees with the version suffix", () => {
    const disagreeing = [
      release({ tag_name: "v9.0.0", prerelease: true }),
      release({ tag_name: "v9.1.0-beta.1", prerelease: false }),
      release({ tag_name: "v2.0.0" }),
    ];
    expect(pickRelease(disagreeing, "beta")?.tag_name).toBe("v2.0.0");
  });

  it("skips malformed tags", () => {
    const malformed = [
      release({ tag_name: "nightly-20250801" }),
      release({ tag_name: "v2.6" }),
      release({ tag_name: "" }),
      release({ tag_name: "v1.2.3" }),
    ];
    expect(pickRelease(malformed, "stable")?.tag_name).toBe("v1.2.3");
  });

  it("skips releases missing both latest.yml and an installer asset", () => {
    const releases = [
      release({ tag_name: "v3.0.0", assets: [{ name: "notes.txt" }] }),
      release({ tag_name: "v2.0.0", assets: [{ name: "latest.yml" }] }),
    ];
    expect(pickRelease(releases, "stable")?.tag_name).toBe("v2.0.0");
  });

  it("returns null for empty or all-draft lists", () => {
    expect(pickRelease([], "stable")).toBeNull();
    expect(pickRelease([release({ tag_name: "v1.0.0", draft: true })], "beta")).toBeNull();
    expect(classifyUpdate("2.5.0", null, { switchToStable: false })).toBe("none");
  });
});

describe("classifyUpdate", () => {
  it("classifies equal, newer, and older versions", () => {
    expect(classifyUpdate("2.5.0", "2.5.0", { switchToStable: false })).toBe("none");
    expect(classifyUpdate("2.5.0", "2.6.0", { switchToStable: false })).toBe("upgrade");
    expect(classifyUpdate("2.6.0-beta.1", "2.5.0", { switchToStable: false })).toBe("none");
    expect(classifyUpdate("2.6.0-beta.1", "2.5.0", { switchToStable: true })).toBe(
      "downgrade-offer",
    );
    expect(classifyUpdate("garbage", "2.5.0", { switchToStable: true })).toBe("none");
  });
});

// Regression pin for #22609 (patch auto-download not triggering).
describe("shouldAutoDownload", () => {
  it("auto-downloads patch deltas only, for regular installs only", () => {
    expect(shouldAutoDownload("2.6.0", "2.6.1", "regular")).toBe(true);
    expect(shouldAutoDownload("2.6.0", "2.7.0", "regular")).toBe(false);
    expect(shouldAutoDownload("2.6.0-beta.1", "2.6.0-beta.2", "regular")).toBe(true);
    expect(shouldAutoDownload("2.6.0", "2.6.0", "regular")).toBe(false);
    expect(shouldAutoDownload("2.6.0", "2.6.1", "managed")).toBe(false);
  });
});

describe("repoForChannel", () => {
  it("selects the staging repo only for preview builds", () => {
    vi.stubEnv("IS_PREVIEW_BUILD", "");
    expect(repoForChannel()).toBe("Vortex");
    vi.stubEnv("IS_PREVIEW_BUILD", "true");
    expect(repoForChannel()).toBe("Vortex-Staging");
  });
});

describe("resolveUpdate fetching", () => {
  beforeEach(() => {
    vi.stubEnv("IS_PREVIEW_BUILD", "");
  });

  it("resolves the picked release with download url and collected notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(fixture));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveUpdate("beta", "2.5.0-beta.1");
    expect(resolved).toMatchObject({
      tag: "v2.6.0-beta.1",
      version: "2.6.0-beta.1",
      prerelease: true,
      downloadBaseUrl: "https://github.com/Nexus-Mods/Vortex/releases/download/v2.6.0-beta.1",
    });
    // notes: candidates in (2.5.0-beta.1, 2.6.0-beta.1], newest first
    expect(resolved?.notesHtml).toContain("2.6.0-beta.1");
    expect(resolved?.notesHtml).toContain("2.5.0");
    expect(resolved?.notesHtml).not.toContain("2.4.1");
  });

  it("serves the cached body on 304 and sends if-none-match", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(fixture, { headers: { etag: '"abc"' } }))
      .mockResolvedValueOnce(jsonResponse("", { status: 304 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await resolveUpdate("stable", "2.4.0");
    const second = await resolveUpdate("stable", "2.4.0");
    expect(first?.version).toBe("2.5.0");
    expect(second?.version).toBe("2.5.0");

    const secondCall = fetchMock.mock.calls[1]![1] as { headers: Record<string, string> };
    expect(secondCall.headers["if-none-match"]).toBe('"abc"');
  });

  it("throws RateLimitError and short-circuits until reset without refetching", async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse("rate limited", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(resetAt) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUpdate("stable", "2.4.0")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(resolveUpdate("stable", "2.4.0")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a one-minute reset when the rate-limit reset header is garbage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse("rate limited", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "not-a-number" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUpdate("stable", "2.4.0")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // the fallback reset is in the future, so the short-circuit still engages
    await expect(resolveUpdate("stable", "2.4.0")).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows Link pagination and stops at the page cap", async () => {
    const pageOf = (tag: string) => [release({ tag_name: tag, assets: [{ name: "latest.yml" }] })];
    const linkTo = (page: number) =>
      `<https://api.github.com/repos/Nexus-Mods/Vortex/releases?per_page=100&page=${page}>; rel="next"`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf("v1.0.0"), { headers: { link: linkTo(2) } }))
      .mockResolvedValueOnce(jsonResponse(pageOf("v1.1.0"), { headers: { link: linkTo(3) } }))
      .mockResolvedValueOnce(jsonResponse(pageOf("v1.2.0"), { headers: { link: linkTo(4) } }))
      .mockResolvedValue(jsonResponse(pageOf("v9.9.9")));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveUpdate("stable", "0.1.0");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(resolved?.version).toBe("1.2.0");
  });

  it("throws on malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse("not json {{")));
    await expect(resolveUpdate("stable", "2.4.0")).rejects.toThrow(/malformed JSON/);
  });

  it("uses the env overrides for api and download bases", async () => {
    vi.stubEnv("VORTEX_UPDATER_API_BASE", "http://localhost:9999");
    vi.stubEnv("VORTEX_UPDATER_DOWNLOAD_BASE", "http://localhost:9999");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(fixture));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await resolveUpdate("stable", "2.4.0");
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/^http:\/\/localhost:9999\//);
    expect(resolved?.downloadBaseUrl).toBe(
      "http://localhost:9999/Nexus-Mods/Vortex/releases/download/v2.5.0",
    );
  });
});
