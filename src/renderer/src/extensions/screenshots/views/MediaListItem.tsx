import React from "react";

import type { GameMediaItem } from "../util/mediaTypes";

interface IMediaListItemProps {
  item: GameMediaItem;
  onClick: () => void;
}

export default function MediaListItem({ item, onClick }: IMediaListItemProps) {
  return (
    <div
      className="border-inside flex size-full items-center justify-center rounded-sm border-2 border-transparent hover:border-white/70"
      onClick={onClick}
    >
      {item.type === "image" && <img key={item.id} src={item.thumbnailPath ?? item.path} />}

      {item.type === "video" && (
        <img key={item.id} src={item.thumbnailPath ?? "assets/images/video-placeholder-temp.png"} />
      )}
    </div>
  );
}
