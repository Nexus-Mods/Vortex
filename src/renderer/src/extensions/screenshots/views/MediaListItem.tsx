import React from "react";

import type { MediaItem } from "../util/mediaTypes";

interface IMediaListItemProps {
  item: MediaItem;
  onClick: () => void;
}

export default function MediaListItem({ item, onClick }: IMediaListItemProps) {
  return (
    <div onClick={onClick}>
      <img key={item.id} src={item.thumbnailPath ?? item.path} />
    </div>
  );
}
