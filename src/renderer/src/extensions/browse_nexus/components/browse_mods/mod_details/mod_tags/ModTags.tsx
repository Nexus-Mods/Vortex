import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import React, { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Mod } from "@/extensions/nexus_integration/queries/mod/mod.query";
import { OVERLAY_ARROW_HEIGHT, OverlayArrow } from "@/ui/components/overlay_arrow/OverlayArrow";
import { Pill } from "@/ui/components/pill/Pill";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

interface IModTagsProps {
  /** The mod's tags, in order. */
  tags: Mod["tags"];
  /** Shows the Adult pill first. */
  isAdult: boolean;
  /** The mod's category, after the Adult pill; none shows no pill. */
  category: string | undefined;
  /** Pulses where the tags go while they load. */
  isLoading: boolean;
}

/** The most tags shown as pills; with any more, all but the first two are counted instead. */
const MAX_SHOWN = 3;

/**
 * A mod's pills: Adult, its category and up to three tags, or two and a "+N more" popover of the
 * rest. They join the row they're in, so they wrap with it.
 */
export const ModTags = ({ tags, isAdult, category, isLoading }: IModTagsProps) => {
  const { t } = useTranslation();
  const shown = tags.length > MAX_SHOWN ? tags.slice(0, MAX_SHOWN - 1) : tags;
  const more = tags.slice(shown.length);
  const [beakFromEnd, setBeakFromEnd] = useState(0);

  return (
    <div className="contents">
      {isAdult && (
        <Pill brand="danger" icon={{ name: "fiber_manual_record", filled: true }}>
          {t("Adult")}
        </Pill>
      )}

      {!!category && <Pill>{category}</Pill>}

      {isLoading && (
        <div className="h-5.5 w-18 animate-pulse rounded-full bg-surface-translucent-mid" />
      )}

      {shown.map((tag) => (
        <Pill key={tag.id}>{tag.name}</Pill>
      ))}

      {more.length > 0 && (
        <Popover>
          <HeadlessPopoverButton as={Fragment}>
            <Pill
              as="button"
              onClick={(event) => setBeakFromEnd(event.currentTarget.offsetWidth / 2)}
            >
              {t("+{{count}} more", { count: more.length })}
            </Pill>
          </HeadlessPopoverButton>

          <PopoverPanel
            anchor={{ gap: 4 + OVERLAY_ARROW_HEIGHT, to: "bottom end" }}
            className="max-w-80! overflow-visible!"
          >
            <OverlayArrow side="bottom" tipFromEnd={beakFromEnd} />

            <div aria-label={t("Tags")} className="flex flex-wrap gap-1 p-3" role="list">
              {more.map((tag) => (
                <Pill key={tag.id} role="listitem">
                  {tag.name}
                </Pill>
              ))}
            </div>
          </PopoverPanel>
        </Popover>
      )}
    </div>
  );
};
