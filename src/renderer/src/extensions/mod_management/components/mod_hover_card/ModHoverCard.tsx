import { mdiImageBroken } from "@mdi/js";
import React from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { HoverCard } from "@/ui/components/hover_card/HoverCard";
import { Image } from "@/ui/components/image/Image";
import { bytesToString } from "@/util/util";

import type { IMod } from "../../types/IMod";
import { modThumbnailUrl } from "../../util/mod_thumbnail_url/modThumbnailUrl";
import { ModAuthor, modAuthor } from "../mod_author/ModAuthor";

interface IModHoverCardProps {
  /** The mod it's about, whose thumbnail opens it. */
  mod: IMod;
  /** The name the row shows, for a mod without its page's title. */
  name: string;
  /** Classes for the thumbnail's frame, which sets its size and corners. */
  className?: string;
}

/**
 * A mod's thumbnail, and more about the mod on hovering it: its page's picture, title and short
 * description, its author and its archive's size.
 */
export const ModHoverCard = ({ mod, name, className }: IModHoverCardProps) => {
  const { attributes } = mod;
  const size = useSelector((state: IState) =>
    mod.archiveId === undefined ? undefined : state.persistent.downloads.files[mod.archiveId]?.size,
  );

  const pictureUrl: string | undefined = attributes?.pictureUrl;
  const thumbnail = modThumbnailUrl(pictureUrl);
  const image = thumbnail ?? pictureUrl;
  const description: string | undefined = attributes?.shortDescription || undefined;
  const author = modAuthor(mod);

  return (
    <HoverCard
      description={description}
      footer={
        (!!author || !!size) && (
          <>
            <ModAuthor mod={mod} />

            {!!size && <span className="shrink-0">{bytesToString(size)}</span>}
          </>
        )
      }
      image={image}
      title={attributes?.modName || name}
    >
      <Image
        alt=""
        className={className}
        fallbackIconPath={mdiImageBroken}
        fit="cover"
        imageType="mod"
        src={thumbnail}
      />
    </HoverCard>
  );
};
