import React from "react";

import { Author } from "@/ui/components/author/Author";

import type { IMod } from "../../types/IMod";
import { uploaderAvatar } from "../../util/uploaderAvatar";

/** A mod's or collection's author, or its uploader where the author isn't known. */
export const modAuthor = (mod: IMod): string | undefined =>
  mod.attributes?.author || mod.attributes?.uploader || undefined;

interface IModAuthorProps {
  /** The mod or collection whose author it shows. */
  mod: IMod;
}

/**
 * Who made a mod or collection, with their avatar, as a hover card's footer shows them,
 * taking the room the rest of the footer leaves. Only the uploader's avatar is known, which
 * is the author's only if they uploaded it; otherwise the fallback icon stands in.
 */
export const ModAuthor = ({ mod }: IModAuthorProps) => {
  const author = modAuthor(mod);
  const avatar = author === mod.attributes?.uploader ? uploaderAvatar(mod.attributes) : undefined;

  return <Author avatar={avatar} className="flex-1" name={author ?? ""} />;
};
