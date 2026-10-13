import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "react-redux";

import type { IState } from "@/types/IState";
import { Bullet } from "@/ui/components/bullet/Bullet";
import { HoverCard } from "@/ui/components/hover_card/HoverCard";
import { Image } from "@/ui/components/image/Image";
import { activeGameId } from "@/util/selectors";
import { bytesToString } from "@/util/util";

import type { IMod } from "../../types/IMod";
import modName from "../../util/modName";
import { findRuleByRef, isDependencyRule } from "../../util/testModReference";
import { ModAuthor, modAuthor } from "../mod_author/ModAuthor";

interface ICollectionHoverCardProps {
  /** The installed collection it's about, whose picture opens it. */
  collection: IMod;
  /** Classes for the cover's frame, which sets its size and corners. */
  className?: string;
}

/** The size of the collection's installed mods' archives, as the store has it now. */
const installedSize = (state: IState, collection: IMod) => {
  const rules = (collection.rules ?? []).filter(isDependencyRule);
  const mods = state.persistent.mods?.[activeGameId(state)] ?? {};
  const files = state.persistent.downloads.files;

  return Object.values(mods).reduce((total, mod) => {
    if (mod.type === collection.type || mod.archiveId === undefined) {
      return total;
    }

    return findRuleByRef(rules, mod) !== undefined
      ? total + (files[mod.archiveId]?.size ?? 0)
      : total;
  }, 0);
};

/**
 * Its mods and their size, as the card's footer shows them. Worked out once as the card
 * opens, as matching every mod against every rule is too much to redo on each store change.
 */
const CollectionStats = ({ collection }: { collection: IMod }) => {
  const { t } = useTranslation(["common"]);
  const store = useStore<IState>();
  const count = (collection.rules ?? []).filter(isDependencyRule).length;
  const size = useMemo(() => installedSize(store.getState(), collection), [collection, store]);

  return (
    <span className="flex shrink-0 items-center gap-x-2">
      <span>{count === 1 ? t("1 mod") : t("{{count}} mods", { count })}</span>

      {!!size && (
        <>
          <Bullet />

          <span>{bytesToString(size)}</span>
        </>
      )}
    </span>
  );
};

/**
 * An installed collection's cover, and more about it on hovering that: its cover, name and
 * summary, its curator, and its mods and their size.
 */
export const CollectionHoverCard = ({ collection, className }: ICollectionHoverCardProps) => {
  const image: string | undefined = collection.attributes?.pictureUrl;
  const description: string | undefined = collection.attributes?.shortDescription || undefined;

  return (
    <HoverCard
      description={description}
      footer={
        <>
          {!!modAuthor(collection) && <ModAuthor mod={collection} />}

          <CollectionStats collection={collection} />
        </>
      }
      image={image}
      imageType="collection"
      title={modName(collection)}
    >
      <Image alt="" className={className} fit="cover" imageType="collection" src={image} />
    </HoverCard>
  );
};
