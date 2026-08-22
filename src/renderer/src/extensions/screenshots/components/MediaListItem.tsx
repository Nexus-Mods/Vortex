import { mdiPlayCircleOutline } from "@mdi/js";
import React from "react";

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
  return (
    <div
      className="border-inside group relative flex size-full items-center justify-center rounded-sm border-2 border-transparent hover:border-white/70"
      onClick={onClick}
    >
      {item.type === "image" && <img key={item.id} src={item.thumbnailPath ?? item.path} />}

      {item.type === "video" && (
        <img
          className="aspect-video object-contain object-top"
          key={item.id}
          src={
            item.thumbnailPath ??
            gameTileImageURL(game) ??
            "assets/images/video-placeholder-temp.png"
          }
        />
      )}

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
