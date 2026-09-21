import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserCanceled } from "@vortex/shared/errors";
import React from "react";
import { Provider } from "react-redux";
import type { Store } from "redux";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { IState } from "../../../types/IState";
import type { ISupportBundle } from "../util/prepareSupportBundle";
import { SUPPORT_DISCORD_URL, SUPPORT_FORUM_URL, SupportBundleDialog } from "./SupportBundleDialog";

const { prepareMock } = vi.hoisted(() => ({ prepareMock: vi.fn() }));

vi.mock("../util/prepareSupportBundle", () => ({ prepareSupportBundle: prepareMock }));

const ARCHIVE_PATH = "C:\\temp\\support_bundles\\vortex-support-2026-09-21.7z";

interface IDeferred {
  resolve: (bundle: ISupportBundle) => void;
  reject: (err: unknown) => void;
}

let deferred: IDeferred;
let capturedSignal: AbortSignal | undefined;
let cleanupMock: Mock<() => Promise<void>>;

const fakeStore = {
  getState: () => ({}),
  subscribe: () => () => {},
  dispatch: vi.fn(),
} as unknown as Store<IState>;

const shell = () =>
  (
    window as unknown as {
      api: {
        shell: { showItemInFolder: ReturnType<typeof vi.fn>; openUrl: ReturnType<typeof vi.fn> };
      };
    }
  ).api.shell;

const renderDialog = (onHide: () => void, visible = true) =>
  render(
    <Provider store={fakeStore}>
      <SupportBundleDialog visible={visible} onHide={onHide} />
    </Provider>,
  );

/** Hands the pending build its result and lets the resulting state update settle. */
const resolveBuild = async () => {
  await act(async () => {
    deferred.resolve({ archivePath: ARCHIVE_PATH, cleanup: cleanupMock });
  });
};

const rejectBuild = async (err: unknown) => {
  await act(async () => {
    deferred.reject(err);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedSignal = undefined;
  cleanupMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  prepareMock.mockImplementation(
    (_store: unknown, options?: { signal?: AbortSignal }) =>
      new Promise<ISupportBundle>((resolve, reject) => {
        capturedSignal = options?.signal;
        deferred = { resolve, reject };
      }),
  );

  (window as unknown as { api: Record<string, unknown> }).api.shell = {
    showItemInFolder: vi.fn(),
    openUrl: vi.fn(),
    openFile: vi.fn(),
  };
});

describe("SupportBundleDialog", () => {
  it("renders nothing and builds nothing while hidden", () => {
    renderDialog(vi.fn(), false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("shows the status line and disables Open while preparing", () => {
    renderDialog(vi.fn());

    expect(prepareMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("support-bundle-status")).toBeInTheDocument();
    expect(screen.getByTestId("support-bundle-open")).toBeDisabled();
  });

  it("opens the forum and Discord links in the system browser", async () => {
    renderDialog(vi.fn());

    await userEvent.click(screen.getByTestId("support-bundle-link-forums"));
    await userEvent.click(screen.getByTestId("support-bundle-link-discord"));

    expect(shell().openUrl).toHaveBeenNthCalledWith(1, SUPPORT_FORUM_URL);
    expect(shell().openUrl).toHaveBeenNthCalledWith(2, SUPPORT_DISCORD_URL);
  });

  it("reveals the archive without deleting it when Open is clicked", async () => {
    renderDialog(vi.fn());
    await resolveBuild();

    const open = screen.getByTestId("support-bundle-open");
    expect(open).toBeEnabled();
    expect(screen.queryByTestId("support-bundle-status")).not.toBeInTheDocument();

    await userEvent.click(open);

    expect(shell().showItemInFolder).toHaveBeenCalledWith(ARCHIVE_PATH);
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("keeps the archive when the dialog is closed after Open", async () => {
    const onHide = vi.fn();
    renderDialog(onHide);
    await resolveBuild();

    await userEvent.click(screen.getByTestId("support-bundle-open"));
    await userEvent.click(screen.getByTestId("support-bundle-cancel"));

    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("keeps a second bundle after Open just like the first", async () => {
    const onHide = vi.fn();
    const { rerender } = renderDialog(onHide);
    await resolveBuild();
    await userEvent.click(screen.getByTestId("support-bundle-open"));
    await userEvent.click(screen.getByTestId("support-bundle-cancel"));
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));

    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={onHide} />
      </Provider>,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={true} onHide={onHide} />
      </Provider>,
    );
    expect(prepareMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId("support-bundle-open")).toBeDisabled();

    await resolveBuild();
    await userEvent.click(screen.getByTestId("support-bundle-open"));
    expect(shell().showItemInFolder).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByTestId("support-bundle-cancel"));
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(2));

    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={onHide} />
      </Provider>,
    );
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("keeps the archive when closed after it is ready without opening it", async () => {
    const onHide = vi.fn();
    const { rerender } = renderDialog(onHide);
    await resolveBuild();

    await userEvent.click(screen.getByTestId("support-bundle-cancel"));
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));

    // the effect cleanup runs once the parent actually hides the dialog
    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={onHide} />
      </Provider>,
    );

    expect(cleanupMock).not.toHaveBeenCalled();
    expect(shell().showItemInFolder).not.toHaveBeenCalled();
  });

  it("keeps the archive when dismissed by Escape after it is ready", async () => {
    const onHide = vi.fn();
    const { rerender } = renderDialog(onHide);
    await resolveBuild();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));

    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={onHide} />
      </Provider>,
    );

    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it("aborts the build when cancelled while preparing", async () => {
    const onHide = vi.fn();
    const { rerender } = renderDialog(onHide);

    await userEvent.click(screen.getByTestId("support-bundle-cancel"));
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));

    // Cancel only asks the parent to hide; the abort happens once it does
    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={onHide} />
      </Provider>,
    );

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("hides on Escape", async () => {
    const onHide = vi.fn();
    renderDialog(onHide);

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
  });

  it("aborts the build when it is hidden mid-build", () => {
    const { rerender } = renderDialog(vi.fn());

    rerender(
      <Provider store={fakeStore}>
        <SupportBundleDialog visible={false} onHide={vi.fn()} />
      </Provider>,
    );

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("reports a failure and rebuilds on Try again", async () => {
    renderDialog(vi.fn());
    await rejectBuild(new Error("7z exited with code 2"));

    expect(screen.getByTestId("support-bundle-error")).toBeInTheDocument();
    expect(screen.queryByTestId("support-bundle-open")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("support-bundle-retry"));

    expect(prepareMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("support-bundle-status")).toBeInTheDocument();
  });

  it("stays quiet when the build reports it was cancelled", async () => {
    renderDialog(vi.fn());
    await rejectBuild(new UserCanceled());

    expect(screen.queryByTestId("support-bundle-error")).not.toBeInTheDocument();
  });
});
