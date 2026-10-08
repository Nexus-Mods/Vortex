import { mdiFolderDownload } from "@mdi/js";
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
 * Makes the whole Mods page a drop target for files from Explorer, with an overlay over the
 * page while a drag is over it. Drag enter and leave fire for every child the pointer
 * crosses, so a depth count rather than the latest event decides whether it is showing.
 */
export const ModsDropTarget = ({ onDropFiles, children }: IModsDropTargetProps) => {
  const { t } = useTranslation("mod_management");
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);

  // A drag cancelled with Esc, or dropped somewhere else, may never send the last leave.
  useEffect(() => {
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, [reset]);

  const onDragEnter = useCallback((evt: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(evt)) {
      return;
    }
    evt.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((evt: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(evt)) {
      return;
    }
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) {
      setDragging(false);
    }
  }, []);

  const onDragOver = useCallback((evt: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(evt)) {
      return;
    }
    evt.preventDefault();
    // react-dnd's window listener may have set "none" for a drag it has no target for.
    evt.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (evt: DragEvent<HTMLDivElement>) => {
      if (!isFileDrag(evt)) {
        return;
      }
      evt.preventDefault();
      reset();
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
          className="pointer-events-none absolute inset-0 z-1000 flex items-center justify-center bg-scrim-800 p-6"
          data-testid="mods-drop-overlay"
        >
          <div className="flex w-full max-w-md flex-col items-center gap-y-2 rounded-lg border-2 border-dashed border-on-scrim-weak px-6 py-10 text-center">
            <Icon className="text-on-scrim-moderate" path={mdiFolderDownload} size="2xl" />

            <Typography
              appearance="strong"
              as="p"
              brand="neutral-on-scrim"
              typographyType="heading-xs"
            >
              {t("Drop files to install")}
            </Typography>

            <Typography
              appearance="moderate"
              as="p"
              brand="neutral-on-scrim"
              typographyType="body-md"
            >
              {t("Archives are added to your downloads, other files can become a new mod")}
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
};
