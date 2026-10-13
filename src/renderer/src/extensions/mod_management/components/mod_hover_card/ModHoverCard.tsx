import { mdiAccount } from "@mdi/js";
import React, { type ReactElement } from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { HoverCard } from "@/ui/components/hover_card/HoverCard";
import { Image } from "@/ui/components/image/Image";
import { bytesToString } from "@/util/util";

import type { IMod } from "../../types/IMod";
import { uploaderAvatar } from "../../util/uploaderAvatar";
import { modThumbnailUrl } from "../mod_thumbnail/ModThumbnail";

interface IModHoverCardProps {
  /** The trigger, such as the mod's thumbnail. Must forward a ref to a DOM node. */
  children: ReactElement;
  /** The mod it's about. */
  mod: IMod;
  /** The name the row shows, for a mod without its page's title. */
  name: string;
}

/**
 * More about a mod on hovering its thumbnail: its page's picture, title and short
 * description, its author and its archive's size. Nothing for a mod with neither a picture
 * nor a description, as the row already shows the rest.
 */
export const ModHoverCard = ({ children, mod, name }: IModHoverCardProps) => {
  const { attributes } = mod;
  const size = useSelector((state: IState) =>
    mod.archiveId === undefined ? undefined : state.persistent.downloads.files[mod.archiveId]?.size,
  );

  const pictureUrl: string | undefined = attributes?.pictureUrl;
  // The thumbnail is wide enough for the card; the full size where there's none.
  const image = modThumbnailUrl(pictureUrl) ?? pictureUrl;
  const description: string | undefined = attributes?.shortDescription || undefined;
  const author: string | undefined = attributes?.author || attributes?.uploader;
  // Only the uploader's avatar is known, which is the author's only if they uploaded it.
  const avatar = author === attributes?.uploader ? uploaderAvatar(attributes) : undefined;

  return (
    <HoverCard
      description={description}
      disabled={!image && !description}
      footer={
        (!!author || !!size) && (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-x-1.5">
              {!!avatar && (
                <Image
                  alt=""
                  className="size-4 shrink-0 rounded-full border border-stroke-weak"
                  fallbackIconPath={mdiAccount}
                  fit="cover"
                  imageType="avatar"
                  src={avatar}
                />
              )}

              <span className="truncate">{author}</span>
            </span>

            {!!size && <span className="shrink-0">{bytesToString(size)}</span>}
          </>
        )
      }
      image={image}
      title={attributes?.modName || name}
    >
      {children}
    </HoverCard>
  );
};
