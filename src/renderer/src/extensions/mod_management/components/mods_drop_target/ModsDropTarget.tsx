import { mdiFolderDownloadOutline } from "@mdi/js";
import { webUtils } from "electron";
import React, {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

export interface IModsDropTargetProps {
  onDropFiles: (paths: string[]) => void;
  children: ReactNode;
}

/**
 * Only files dragged in from outside the app count. react-dnd's internal drags, such as
 * the dependency icon dragged between rows, never carry "Files".
 */
const isFileDrag = (evt: DragEvent<HTMLElement>): boolean =>
  Array.from(evt.dataTransfer?.types ?? []).includes("Files");

/**
 * React drag events bubble through portals, so a tooltip, menu or dialog opened from inside
 * the page reaches its handlers without being part of its DOM. Only a drag over the page's
 * own DOM counts.
 */
const isOverPage = (evt: DragEvent<HTMLElement>): boolean =>
  evt.currentTarget.contains(evt.target as Node);

/** Longer than the gap between the dragover events Chromium sends while a drag holds still. */
export const DRAG_WATCHDOG_MS = 1000;

/**
 * Makes the whole Mods page a drop target for files from Explorer, with an overlay over the
 * page while a drag is over it. The overlay is a card on the scrim, styled like the modal
 * panel, so its text sits on a solid surface rather than on the darkened page.
 *
 * Enter and leave events don't pair up reliably: a child that unmounts mid-drag never sends
 * its leave, and a drag from outside the app never gets a dragend. So a leave hides the
 * overlay only when the pointer has gone somewhere outside the page, and a watchdog hides it
 * when the dragover events a held drag keeps sending stop arriving, as they do after Esc.
 * A drop anywhere else in the window hides it too.
 *
 * Dragover sets the drop effect itself because react-dnd's window listener may already
 * have set "none" for a drag it has no target for.
 */
export const ModsDropTarget = ({ onDropFiles, children }: IModsDropTargetProps) => {
  const { t } = useTranslation("mod_management");
  const [dragging, setDragging] = useState(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reset = useCallback(() => {
    clearTimeout(watchdog.current);
    watchdog.current = undefined;
    setDragging(false);
  }, []);

  const show = useCallback(() => {
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(reset, DRAG_WATCHDOG_MS);
    setDragging(true);
  }, [reset]);

  useEffect(() => {
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("drop", reset);
      clearTimeout(watchdog.current);
    };
  }, [reset]);

  const onDragEnter = useCallback(
    (evt: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(evt) || !isOverPage(evt)) {
        return;
      }
      evt.preventDefault();
      show();
    },
    [show],
  );

  const onDragLeave = useCallback(
    (evt: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(evt)) {
        return;
      }
      const next = evt.relatedTarget as Node | null;
      if (next === null || !evt.currentTarget.contains(next)) {
        reset();
      }
    },
    [reset],
  );

  const onDragOver = useCallback(
    (evt: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(evt) || !isOverPage(evt)) {
        return;
      }
      evt.preventDefault();
      evt.dataTransfer.dropEffect = "copy";
      show();
    },
    [show],
  );

  const onDrop = useCallback(
    (evt: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(evt)) {
        return;
      }
      reset();
      if (!isOverPage(evt)) {
        return;
      }
      evt.preventDefault();
      const paths = Array.from(evt.dataTransfer.files)
        .map((file) => webUtils.getPathForFile(file))
        .filter((filePath) => !!filePath);
      if (paths.length > 0) {
        onDropFiles(paths);
      }
    },
    [onDropFiles, reset],
  );

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="mods-drop-target"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}

      {dragging && (
        <div
          className="pointer-events-none absolute inset-0 z-dropzone flex items-center justify-center bg-scrim-800 p-6"
          data-testid="mods-drop-overlay"
        >
          <div className="w-full max-w-md rounded-lg border border-surface-translucent-low bg-surface-low p-3 shadow-xl">
            <div className="flex flex-col items-center gap-y-2 rounded-md border-2 border-dashed border-primary-moderate px-6 py-10 text-center">
              <Icon className="text-primary-moderate" path={mdiFolderDownloadOutline} size="2xl" />

              <Typography typographyType="heading-xs">{t("Drop files to add mods")}</Typography>

              <Typography appearance="subdued">
                {t("Archives (.zip, .rar, .7z) are added as mods to your list.")}
              </Typography>

              <Typography appearance="subdued">
                {t("Individual files and folders are packaged into mods before being added.")}
              </Typography>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
