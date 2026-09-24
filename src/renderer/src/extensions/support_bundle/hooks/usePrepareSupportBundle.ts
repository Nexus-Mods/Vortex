import { getErrorMessageOrDefault } from "@vortex/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "react-redux";

import type { IState } from "../../../types/IState";
import { UserCanceled } from "../../../util/CustomErrors";
import { prepareSupportBundle, type ISupportBundle } from "../util/prepareSupportBundle";

export type BuildState =
  | { status: "preparing"; percent?: number }
  | { status: "ready"; archivePath: string }
  | { status: "failed"; message: string };

export interface IPrepareSupportBundleControls {
  state: BuildState;
  /** Reveals the finished archive in the file manager. */
  open: () => void;
  /** Throws the current attempt away and starts a fresh one. */
  retry: () => void;
}

/**
 * Drives one support bundle build for as long as the dialog is open.
 *
 * The build is tied to `visible` rather than to a button, so Cancel, Escape, the backdrop and
 * the header X all cancel it the same way: each hides the dialog, and the effect cleanup is
 * the single place that aborts.
 *
 * Once the archive exists it is the user's: closing the dialog by any route leaves it on
 * disk. Deleting a file the dialog has just announced as ready is too easy to do by accident.
 */
export function usePrepareSupportBundle(visible: boolean): IPrepareSupportBundleControls {
  const store = useStore<IState>();
  const [state, setState] = useState<BuildState>({ status: "preparing" });
  const [buildId, setBuildId] = useState(0);

  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "preparing" });

    // A build that was replaced or cancelled can still resolve, so every callback checks it
    // is still the current one before touching state.
    const isCurrent = () => controllerRef.current === controller;

    prepareSupportBundle(store, {
      signal: controller.signal,
      onProgress: (percent) => {
        if (!isCurrent()) {
          return;
        }

        setState((prev) => (prev.status === "preparing" ? { status: "preparing", percent } : prev));
      },
    })
      .then((bundle: ISupportBundle) => {
        if (!isCurrent()) {
          // A retry replaced this build before it finished, so nobody will ever see or open
          // this archive; keep the folder tidy.
          void bundle.cleanup();
          return;
        }

        setState({ status: "ready", archivePath: bundle.archivePath });
      })
      .catch((err: unknown) => {
        if (!isCurrent() || err instanceof UserCanceled) {
          return;
        }

        setState({ status: "failed", message: getErrorMessageOrDefault(err) });
      });

    return () => {
      controllerRef.current = undefined;
      // A no-op once the build has finished; mid-build it kills the archiver, which removes
      // its own partial output.
      controller.abort();
    };
  }, [buildId, store, visible]);

  const open = useCallback(() => {
    if (state.status !== "ready") {
      return;
    }

    window.api.shell.showItemInFolder(state.archivePath);
  }, [state]);

  const retry = useCallback(() => {
    setBuildId((id) => id + 1);
  }, []);

  return { state, open, retry };
}
