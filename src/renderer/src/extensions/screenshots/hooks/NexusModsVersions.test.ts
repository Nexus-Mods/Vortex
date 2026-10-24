import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IModFile } from "../util/getModFileVersions";
import useNexusModsVersions from "./NexusModsVersions";

const { mockGetAccessToken, mockGetModFiles, mockGetModFileVersions, mockApi } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn<() => Promise<string>>(),
  mockGetModFiles: vi.fn(),
  mockGetModFileVersions: vi.fn(),
  mockApi: {},
}));

vi.mock("@/extensions/nexus_integration/util/oauthSession", () => ({
  getAccessToken: mockGetAccessToken,
}));

vi.mock("../util/getModFileVersions", () => ({
  getModFiles: mockGetModFiles,
  getModFileVersions: mockGetModFileVersions,
}));

const FILES: IModFile[] = [
  {
    id: "file-1",
    name: "Main file",
    is_active: true,
    last_file_updated_at: "2026_08_01",
    versions_count: 2,
    archived_count: 0,
    removed_count: 0,
  },
  {
    id: "file-2",
    name: "Optional file",
    is_active: true,
    last_file_updated_at: "2026_08_01",
    versions_count: 2,
    archived_count: 0,
    removed_count: 0,
  },
];

const VERSIONS = [
  { id: "v-2", version: "2.0" },
  { id: "v-1", version: "1.0" },
];

const render = (onSelect?: (v: unknown) => void) =>
  renderHook(({ onSelect }) => useNexusModsVersions("mod-uid", mockApi as never, onSelect), {
    initialProps: { onSelect },
  });

describe("NexusModsVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue("token");
    mockGetModFiles.mockResolvedValue(FILES);
    mockGetModFileVersions.mockResolvedValue(VERSIONS);
  });

  it("loads the mod's files and selects the first", async () => {
    const { result } = render(vi.fn());

    await waitFor(() => expect(result.current.files).toEqual(FILES));
    expect(result.current.selectedFile).toEqual(FILES[0]);
  });

  it("loads the versions of the selected file and selects the first", async () => {
    const { result } = render(vi.fn());

    await waitFor(() => expect(result.current.versions).toEqual(VERSIONS));
    expect(result.current.selectedVersion).toEqual(VERSIONS[0]);
    expect(mockGetModFileVersions).toHaveBeenCalledWith("file-1", "token", expect.anything());
  });

  it("reports the auto-selected version to the caller", async () => {
    const onSelect = vi.fn();
    render(onSelect);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(VERSIONS[0]));
  });

  it("does not refetch when the caller passes a new onSelect identity", async () => {
    const { rerender } = render(vi.fn());

    await waitFor(() => expect(mockGetModFileVersions).toHaveBeenCalledTimes(1));

    // A parent re-rendering hands over a fresh closure; that must not restart the request,
    // which is what previously looped: fetch -> onSelect -> setState -> new identity -> fetch.
    rerender({ onSelect: vi.fn() });
    rerender({ onSelect: vi.fn() });

    expect(mockGetModFileVersions).toHaveBeenCalledTimes(1);
  });

  it("fetches again when a different file is selected", async () => {
    const { result } = render(vi.fn());

    await waitFor(() => expect(mockGetModFileVersions).toHaveBeenCalledTimes(1));

    act(() => result.current.setSelectedFile(FILES[1]));

    await waitFor(() => expect(mockGetModFileVersions).toHaveBeenCalledTimes(2));
    expect(mockGetModFileVersions).toHaveBeenLastCalledWith("file-2", "token", expect.anything());
  });

  it("reports an error when the files cannot be fetched", async () => {
    const failure = new Error("offline");
    mockGetModFiles.mockRejectedValue(failure);

    const { result } = render(vi.fn());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
    expect(result.current.isLoading).toBe(false);
  });

  it("aborts an in-flight request when unmounted", async () => {
    const { unmount } = render(vi.fn());

    await waitFor(() => expect(mockGetModFiles).toHaveBeenCalled());

    const signal = mockGetModFiles.mock.lastCall[2] as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
