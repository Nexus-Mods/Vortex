/**
 * CollectionTile Component
 * Displays a collection card with image, metadata, and action buttons
 * Adapted from Figma design for collection browsing
 */

import React, {
  type ComponentType,
  Fragment,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Button } from "../button/Button";
import { Typography } from "../typography/Typography";
import { Icon } from "../icon";
import { nxmFileSize, nxmMod } from "../../../lib/icon-paths";
import numeral from "numeral";
import type { IExtensionApi } from "../../../../../types/IExtensionContext";
import { isCollectionModPresent } from "../../../../../util/selectors";
import Debouncer from "../../../../../util/Debouncer";
import { delayed } from "../../../../../util/util";
import { mdiOpenInNew, mdiStar, mdiThumbUp } from "@mdi/js";

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
  // Data
  id: string;
  slug: string;
  gameId: string;
  title: string;
  author: {
    name: string;
    avatar?: string;
  };
  coverImage: string;
  tags: string[]; // Max 2 tags
  stats: {
    endorsements: number;
    modCount: number;
    size: number; // e.g., '540MB'
  };
  description: string;
  version?: string;
  badges?: Array<{
    name: string;
    description: string;
  }>;

  // Actions
  onAddCollection?: () => void;
  onViewPage?: () => void;

  // Style
  className?: string;
}

export const CollectionTile: ComponentType<
  CollectionTileProps & { api: IExtensionApi }
> = ({
  api,
  slug,
  title,
  author,
  coverImage,
  tags,
  stats,
  description,
  badges,
  onAddCollection,
  onViewPage,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [canBeAdded, setCanBeAdded] = useState(true);
  const [tooltip, setTooltip] = useState<string>("Add this collection");
  const [pending, setPending] = useState(false);
  // Helper to extract tag text from string or object
  const getTagText = (tag: any): string => {
    if (typeof tag === "string") {
      return tag;
    }
    if (tag && typeof tag === "object" && "name" in tag) {
      return String(tag.name);
    }
    return String(tag);
  };

  const addCollectionDebounced = () => {
    debouncer.schedule(
      () => setPending(false),
      () => {
        onAddCollection?.();
      },
    );
  };

  useEffect(() => {
    const state = api?.getState?.();
    if (!state) {
      // No state available means we're likely in demo mode, so skip checks.
      //  Need a better mock for the api.
      return;
    }
    const collectionModInstalled = isCollectionModPresent(state, slug);

    setCanBeAdded(!collectionModInstalled);
    setTooltip(
      collectionModInstalled || pending
        ? "Collection already added"
        : "Add this collection",
    );
  }, [api, slug, pending, isHovered]);

  // Refresh user info when user hovers on the tile, debounced to once per 5 seconds
  useEffect(() => {
    if (isHovered && api?.events) {
      userInfoDebouncer.schedule(undefined, () => {
        api.events.emit("refresh-user-info");
      });
    }
  }, [isHovered]);

  // Take max 2 tags
  const displayTags = tags.slice(0, 2);
  const addCollection = useCallback(() => {
    if (!pending && canBeAdded) {
      setPending(true);
      addCollectionDebounced();
    }
  }, [onAddCollection, canBeAdded, pending]);
  const mouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  const mouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // Find the "Easy install" badge (if it exists)
  const easyInstallBadge = badges?.find(
    (badge) => badge.name.toLowerCase() === "easy install",
  );

  return (
    <div
      className={`w-full max-w-[465px] h-[283px] bg-surface-mid flex flex-col justify-start items-start ${className || ""}`}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
    >
      {/* Main content area */}
      <div className="self-stretch flex-1 px-3 pt-3 rounded-tl rounded-tr flex flex-col justify-start items-start gap-2 overflow-hidden">
        <div className="self-stretch flex flex-1 justify-between items-start">
          {/* Left: Image */}
          <div className="w-[175px] h-[219px] relative shrink-0">
            <div className="absolute top-0 left-0">
              <img
                className="w-[166px] h-52 rounded-sm object-cover"
                src={coverImage}
                alt={title}
              />

              {/* Easy Install Badge - conditionally shown */}
              {easyInstallBadge && (
                <div className="absolute rounded-b-sm inset-x-0 bottom-0 z-10">
                  <Typography
                    as="p"
                    typographyType="title-xs"
                    appearance="none"
                    className="flex items-center gap-x-0.5 px-1.5 py-0.5 bg-info-weak text-info-50"
                  >
                    <Icon path={mdiStar} size="xs" />
                    <span
                      className="px-0.5 leading-5"
                      title={easyInstallBadge.description}
                    >
                      {easyInstallBadge.name}
                    </span>
                  </Typography>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex-1 self-stretch flex flex-col justify-start items-start">
            {/* Header: Title + Author */}
            <div className="self-stretch pl-3 pb-2 flex flex-col justify-start items-start gap-0">
              <Typography
                as="div"
                className="line-clamp-1 font-semibold wrap-break-word"
                appearance="strong"
                typographyType="body-xl"
              >
                {title}
              </Typography>

              <div className="flex items-center gap-1">
                {author.avatar && (
                  <img
                    src={author.avatar}
                    alt={author.name}
                    className="w-4 h-4 rounded-full bg-zinc-300"
                  />
                )}
                {!author.avatar && (
                  <div className="w-4 h-4 bg-zinc-300 rounded-full" />
                )}
                <Typography
                  as="div"
                  typographyType="body-sm"
                  appearance="moderate"
                  className="justify-center tracking-tight"
                >
                  {author.name}
                </Typography>
              </div>
            </div>

            {/* Tags section */}
            {displayTags.length > 0 && (
              <div className="self-stretch pl-3 flex flex-col justify-start items-start gap-2">
                <div className="self-stretch py-1.5 border-t border-b border-stroke-weak inline-flex justify-start items-center gap-1.5 flex-wrap content-center">
                  {displayTags.map((tag, index) => {
                    const tagText = getTagText(tag);
                    return (
                      <Fragment key={index}>
                        <Typography
                          as="div"
                          typographyType="body-sm"
                          appearance="none"
                          className={`justify-center tracking-tight ${
                            tagText.toLowerCase() === "adult"
                              ? "text-danger-strong"
                              : "text-neutral-moderate"
                          }`}
                        >
                          {tagText}
                        </Typography>
                        {index < displayTags.length - 1 && (
                          <div className="w-1 h-1 rotate-45 bg-neutral-subdued" />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats section */}
            <div className="self-stretch pl-3 inline-flex justify-start items-center gap-5">
              <div className="flex-1 py-1.5 border-b border-stroke-weak flex justify-start items-center gap-5">
                {/* Endorsements */}
                <div className="flex justify-start items-center gap-1 overflow-hidden">
                  <Icon path={mdiThumbUp} size="sm" />
                  <Typography
                    as="div"
                    typographyType="body-sm"
                    appearance="moderate"
                    className="justify-start tracking-tight"
                  >
                    {numeral(stats.endorsements).format("0 a")}
                  </Typography>
                </div>

                {/* Size */}
                <div className="flex justify-center items-center gap-1 overflow-hidden">
                  <Icon path={nxmFileSize} size="sm" />
                  <Typography
                    as="div"
                    typographyType="body-sm"
                    appearance="moderate"
                    className="justify-start tracking-tight"
                  >
                    {numeral(stats.size).format("0.0 b")}
                  </Typography>
                </div>

                {/* Mod count */}
                <div className="flex justify-center items-center gap-1 overflow-hidden">
                  <Icon path={nxmMod} size="sm" />
                  <Typography
                    as="div"
                    typographyType="body-sm"
                    appearance="moderate"
                    className="justify-start tracking-tight"
                  >
                    {numeral(stats.modCount).format("0,0")}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="self-stretch flex-1 pl-3 py-1 flex flex-col justify-start items-start gap-2">
              <Typography
                as="div"
                typographyType="body-md"
                appearance="subdued"
                className="line-clamp-4 wrap-break-word"
              >
                {description}
              </Typography>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="self-stretch p-3 bg-surface-high rounded-bl rounded-br inline-flex justify-start items-center gap-2">
        <Button
          title={tooltip}
          disabled={!canBeAdded || pending}
          buttonType="primary"
          size="sm"
          onClick={addCollection}
        >
          Add collection
        </Button>

        <Button
          buttonType="tertiary"
          size="sm"
          onClick={onViewPage}
          leftIconPath={mdiOpenInNew}
        >
          View page
        </Button>
      </div>
    </div>
  );
};
