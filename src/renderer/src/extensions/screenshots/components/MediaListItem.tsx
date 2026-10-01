import { pathToFileURL } from "url";

import { mdiPlayCircleOutline } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IGameStored } from "@/extensions/gamemode_management/types/IGameStored";
import { gameTileImageURL } from "@/extensions/nexus_integration/util/gameTileImageURL";
import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import relativeTime from "@/util/relativeTime";

import type { GameMediaItem } from "../util/mediaTypes";

interface IMediaListItemProps {
  item: GameMediaItem;
  game: IGameStored | undefined;
  onClick: () => void;
}

export default function MediaListItem({ item, onClick, game }: IMediaListItemProps) {
  const { t } = useTranslation("media_page");

  const fallbackURL = "assets/images/ad-banner-large.png";

  const [src, setSrc] = useState(() => {
    if (item.type === "image") return pathToFileURL(item.thumbnailPath ?? item.path).toString();
    else if (item.type === "video") {
      const thumbnail = item.thumbnailPath ? pathToFileURL(item.thumbnailPath) : undefined;
      return thumbnail ? thumbnail.toString() : gameTileImageURL(game)?.replace("tile", "hero");
    }
  });

  const onError = () => {
    setSrc(fallbackURL);
  };

  return (
    <button
      className="border-inside group flex size-full flex-col items-start gap-2"
      title={item.name}
      type="button"
      onClick={onClick}
    >
      <div className="relative w-full overflow-hidden rounded-sm after:pointer-events-none after:absolute after:inset-0 after:bg-white after:opacity-0 after:transition-opacity group-hover:after:opacity-20">
        <img
          alt={item.name}
          className="aspect-video w-full object-cover object-right"
          decoding="async"
          key={item.id}
          loading="lazy"
          src={src}
          onError={onError}
        />

        {item.type === "video" && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-1/2 opacity-60 drop-shadow-md"
            path={mdiPlayCircleOutline}
            size="2xl"
          />
        )}
      </div>

      <div className="flex flex-col items-start gap-0.5">
        <Typography appearance="subdued" typographyType="body-md">
          {relativeTime(item.createdAt, t)}
        </Typography>
      </div>
    </button>
  );
}
