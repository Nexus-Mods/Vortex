import { mdiPlayCircleOutline } from "@mdi/js";
import React, { useState } from "react";

import { gameTileImageURL } from "@/extensions/nexus_integration/util/gameTileImageURL";
import type { IGameStored } from "@/types/api";
import { Icon } from "@/ui/components/icon/Icon";
import type { TFunction } from "@/util/i18n";
import relativeTime from "@/util/relativeTime";

import type { GameMediaItem } from "../util/mediaTypes";

interface IMediaListItemProps {
  item: GameMediaItem;
  game: IGameStored;
  onClick: () => void;
  t: TFunction;
}

export default function MediaListItem({ item, onClick, t, game }: IMediaListItemProps) {
  const fallbackURL = "assets/images/ad-banner-large.png";

  const [src, setSrc] = useState(() => {
    if (item.type === "image") return item.thumbnailPath ?? item.path;
    else if (item.type === "video")
      return item.thumbnailPath ?? gameTileImageURL(game)?.replace("tile", "hero");
  });

  const onError = () => {
    setSrc(fallbackURL);
  };

  return (
    <div
      className="border-inside group relative flex size-full items-center justify-center rounded-sm border-2 border-transparent hover:border-white/70"
      onClick={onClick}
    >
      <img
        className="aspect-video object-cover object-right"
        key={item.id}
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
    </div>
  );
}
