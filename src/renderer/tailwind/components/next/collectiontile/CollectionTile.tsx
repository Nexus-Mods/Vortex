/**
 * CollectionTile Component
 * Displays a collection card with image, metadata, and action buttons
 * Adapted from Figma design for collection browsing
 */

import { mdiCheck, mdiOpenInNew, mdiStar, mdiThumbUp } from "@mdi/js";
import { type ICollection } from "@nexusmods/nexus-api";
import numeral from "numeral";
import React, {
  type ComponentType,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useState,
} from "react";

import type { IExtensionApi } from "../../../../types/IExtensionContext";

import Debouncer from "../../../../util/Debouncer";
import { isCollectionModPresent } from "../../../../util/selectors";
import { delayed } from "../../../../util/util";
import { nxmFileSize, nxmMod } from "../../../lib/icon-paths";
import { Button } from "../button";
import { Icon } from "../icon";
import { Typography } from "../typography";
import { joinClasses } from "../utils";

const debouncer = new Debouncer(
  (func: () => void) => {
    func?.();
    return delayed(5000);
  },
  5000,
  false,
  true,
);

const userInfoDebouncer = new Debouncer(
  (func: () => void) => {
    func?.();
    return Promise.resolve();
  },
  10000,
  false,
  true,
);

export interface CollectionTileProps {
  api: IExtensionApi;
  collection: ICollection;
  onAddCollection?: () => void;
  onViewPage?: () => void;
  className?: string;
}

const Stat = ({
  children,
  iconPath,
}: PropsWithChildren<{ iconPath: string }>) => (
  <div className="flex items-center gap-x-1">
    <Icon className="text-neutral-subdued" path={iconPath} size="sm" />

    <Typography appearance="moderate" typographyType="body-sm">
      {children}
    </Typography>
  </div>
);

export const CollectionTile: ComponentType<CollectionTileProps> = ({
  api,
  collection,
  onAddCollection,
  onViewPage,
  className,
}) => {
  const revision = collection.latestPublishedRevision;

  const [isHovered, setIsHovered] = useState(false);
  const [canBeAdded, setCanBeAdded] = useState(true);
  const [pending, setPending] = useState(false);

  const addCollectionDebounced = () =>
    debouncer.schedule(
      () => setPending(false),
      () => onAddCollection?.(),
    );

  useEffect(() => {
    const state = api?.getState?.();

    if (!state) {
      // No state available means we're likely in demo mode, so skip checks.
      //  Need a better mock for the api.
      return;
    }

    const collectionModInstalled = isCollectionModPresent(
      state,
      collection.slug,
    );
    setCanBeAdded(!collectionModInstalled);
  }, [api, collection.slug, pending, isHovered]);

  // Refresh user info when user hovers on the tile, debounced to once per 5 seconds
  useEffect(() => {
    if (isHovered && api?.events) {
      userInfoDebouncer.schedule(undefined, () => {
        api.events.emit("refresh-user-info");
      });
    }
  }, [isHovered]);

  const addCollection = useCallback(() => {
    if (!pending && canBeAdded) {
      setPending(true);
      addCollectionDebounced();
    }
  }, [onAddCollection, canBeAdded, pending]);

  // Find the "Easy install" badge (if it exists)
  const easyInstallBadge = collection.badges?.find(
    (badge) => badge.name.toLowerCase() === "easy install",
  );

  return (
    <div
      className={joinClasses(["w-full rounded-md bg-surface-mid", className])}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-x-3.5 p-3">
        <div className="relative flex aspect-4/5 w-full max-w-35 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-surface-translucent-low">
          <img
            alt={collection.name}
            className="absolute z-1 h-full max-w-none"
            src={collection.tileImage?.thumbnailUrl}
          />

          {easyInstallBadge && (
            <div className="absolute inset-x-0 bottom-0 z-2">
              <Typography
                appearance="none"
                className="flex h-7 items-center gap-x-1 bg-info-weak px-1.5 text-info-50"
                typographyType="title-xs"
              >
                <Icon path={mdiStar} size="xs" />

                <span title={easyInstallBadge.description}>
                  {easyInstallBadge.name}
                </span>
              </Typography>
            </div>
          )}
        </div>

        <div className="flex min-w-0 grow flex-col gap-y-1.5">
          <div className="flex flex-col gap-y-1">
            <Typography
              className="truncate font-semibold wrap-break-word"
              typographyType="body-lg"
            >
              {collection.name}
            </Typography>

            <Typography
              appearance="moderate"
              className="flex items-center gap-x-1"
              typographyType="body-sm"
            >
              <div className="size-4 overflow-hidden rounded-full bg-surface-translucent-low">
                {collection.user?.avatar && (
                  <img
                    alt={collection.user?.name}
                    className="size-4"
                    src={collection.user.avatar}
                  />
                )}
              </div>

              {collection.user?.name}
            </Typography>
          </div>

          <div className="flex items-center gap-x-1.5 border-t border-stroke-weak pt-1.5">
            <Typography
              appearance="none"
              className="text-info-strong"
              typographyType="body-sm"
            >
              {collection.category?.name}
            </Typography>

            {revision.adultContent && (
              <>
                <div className="size-1 rotate-45 bg-neutral-subdued" />

                <Typography
                  appearance="none"
                  className="text-danger-strong"
                  typographyType="body-sm"
                >
                  Adult
                </Typography>
              </>
            )}
          </div>

          <div className="flex items-center gap-x-5 border-t border-stroke-weak pt-1.5">
            <Stat iconPath={mdiThumbUp}>
              {numeral(collection.endorsements).format("0 a")}
            </Stat>

            <Stat iconPath={nxmFileSize}>
              {numeral(revision.totalSize).format("0.0 b")}
            </Stat>

            <Stat iconPath={nxmMod}>
              {numeral(revision.modCount).format("0,0")}
            </Stat>
          </div>

          <Typography
            appearance="subdued"
            className="line-clamp-3 border-t border-stroke-weak pt-1.5 wrap-break-word"
            typographyType="body-sm"
          >
            {collection.summary}
          </Typography>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-x-2 rounded-b bg-surface-translucent-low px-3 py-2">
        {!canBeAdded || pending ? (
          <Button
            buttonType="tertiary"
            disabled={true}
            leftIconPath={mdiCheck}
            size="xs"
          >
            Added
          </Button>
        ) : (
          <Button size="xs" onClick={addCollection}>
            Add collection
          </Button>
        )}

        <Button
          buttonType="tertiary"
          leftIconPath={mdiOpenInNew}
          size="xs"
          onClick={onViewPage}
        >
          View page
        </Button>
      </div>
    </div>
  );
};
