import { pathToFileURL } from "url";

import { mdiPlayCircleOutline } from "@mdi/js";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import type { IGameStored } from "@/extensions/gamemode_management/types/IGameStored";
import { gameTileImageURL } from "@/extensions/nexus_integration/util/gameTileImageURL";
import { Icon } from "@/ui/components/icon/Icon";
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
      className="border-inside group relative flex size-full items-center justify-center rounded-sm border-2 border-transparent hover:border-white/70"
      type="button"
      onClick={onClick}
    >
      <img
        alt={item.name}
        className="aspect-video object-cover object-right"
        decoding="async"
        key={item.id}
        loading="lazy"
        src={src}
        onError={onError}
      />

      {/* overlay */}
      <div className="absolute top-0 left-0 size-full opacity-0 group-hover:opacity-100">
        <div className="flex h-full flex-col items-start justify-between gap-2">
          {item.createdAt && (
            <span className="line-clamp-1 shrink rounded-sm bg-surface-high/70 p-0.5">
              {relativeTime(item.createdAt, t)}
            </span>
          )}

          {item.type === "video" && (
            <Icon className="m-auto" path={mdiPlayCircleOutline} size="2xl" />
          )}

          <span className="line-clamp-1 rounded-sm bg-surface-high p-0.5">{item.name}</span>
        </div>
      </div>
    </button>
  );
}
