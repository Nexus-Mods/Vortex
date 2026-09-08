import type { OpenChangeReason } from "@floating-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

export const AUTO_DISMISS_MS = 5000;

/** Reasons that mean the pointer is on the button, so the flyout is its own again. */
const POINTER_REASONS: OpenChangeReason[] = ["focus", "hover", "safe-polygon"];

export interface IDownloadFlyout {
  downloadId: string | undefined;
  isAnnouncing: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean, reason?: OpenChangeReason) => void;
}

/**
 * When the download flyout shows itself and which download it names. It opens on its own
 * when a download appears and then dismisses itself; hovering the button is what brings
 * it back, which the `Tooltip` it drives handles by itself.
 */
export const useDownloadFlyout = (activeIds: string[]): IDownloadFlyout => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [downloadId, setDownloadId] = useState<string | undefined>(undefined);

  // Undefined until the first run, which seeds it: a session resuming with downloads
  // already in flight has no news to announce.
  const knownIdsRef = useRef<Set<string> | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isPointerOnRef = useRef(false);
  const hasActiveRef = useRef(false);

  const cancelAutoDismiss = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => cancelAutoDismiss, [cancelAutoDismiss]);

  useEffect(() => {
    const known = knownIdsRef.current;
    knownIdsRef.current = new Set(activeIds);
    hasActiveRef.current = activeIds.length > 0;

    // The named download is deliberately kept: the panel is still on screen for its exit
    // transition, and dropping it now flicks the content back to the plain label first.
    if (activeIds.length === 0) {
      cancelAutoDismiss();
      setIsAnnouncing(false);
      setIsOpen(false);
      return;
    }

    setDownloadId((current) =>
      current !== undefined && activeIds.includes(current) ? current : activeIds[0],
    );

    if (known === undefined) {
      return;
    }

    const arrived = activeIds.find((id) => !known.has(id));

    if (arrived === undefined) {
      return;
    }

    setDownloadId(arrived);
    setIsAnnouncing(true);
    setIsOpen(true);

    cancelAutoDismiss();

    // Dismissing under the pointer would snatch the panel away mid-read, and `Tooltip`
    // won't reopen it until the pointer leaves and comes back.
    if (!isPointerOnRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        setIsAnnouncing(false);
        setIsOpen(false);
      }, AUTO_DISMISS_MS);
    }
  }, [activeIds, cancelAutoDismiss]);

  const onOpenChange = useCallback(
    (next: boolean, reason?: OpenChangeReason) => {
      isPointerOnRef.current = next && reason !== undefined && POINTER_REASONS.includes(reason);

      cancelAutoDismiss();
      // Once the pointer is driving it's an ordinary tooltip again, free to yield to a
      // press elsewhere and to its neighbours.
      setIsAnnouncing(false);

      // Opening with nothing in flight is the moment it is safe to forget the download
      // that was kept above: the panel is about to show the plain label instead.
      if (next && !hasActiveRef.current) {
        setDownloadId(undefined);
      }

      setIsOpen(next);
    },
    [cancelAutoDismiss],
  );

  return { downloadId, isAnnouncing, isOpen, onOpenChange };
};
