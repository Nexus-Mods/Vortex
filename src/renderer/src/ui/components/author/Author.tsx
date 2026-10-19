import { mdiAccount } from "@mdi/js";
import React from "react";

import { Image } from "@/ui/components/image/Image";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IAuthorProps {
  /** Their name, truncated to the room it has. */
  name: string;
  /** Their avatar's URL; the account icon stands in without one. */
  avatar?: string;
  className?: string;
}

/** Someone's avatar and name, in the type around it. */
export const Author = ({ name, avatar, className }: IAuthorProps) => (
  <span className={joinClasses(["flex min-w-0 items-center gap-x-1.5", className])}>
    <Image
      alt=""
      className="size-4 shrink-0 rounded-full"
      fallbackIconPath={mdiAccount}
      fit="cover"
      imageType="avatar"
      src={avatar}
    />

    <span className="truncate">{name}</span>
  </span>
);
