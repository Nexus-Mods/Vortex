import { mdiImageBroken } from "@mdi/js";
import React, { type CSSProperties, type ReactElement, type ReactNode } from "react";

import { Image } from "@/ui/components/image/Image";
import { useImageColour } from "@/ui/components/image/useImageColour.hook";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

/** Longer to open than a tooltip, so sweeping down a list doesn't flash a card on every row. */
const DELAY = { close: 50, open: 500 };

interface IHoverCardProps {
  /** The trigger. Must forward a ref to a DOM node, as a `Tooltip`'s does. */
  children: ReactElement;
  /** The picture across its top, whose colour tints the card; unset, it has none. */
  image?: string;
  /** What it's about, such as a mod page's title. */
  title: string;
  /** A line or two more about it, such as a mod page's short description. */
  description?: string;
  /** What runs along its foot, under a rule, such as the author and the size. */
  footer?: ReactNode;
  /** Renders the trigger alone, with no card, such as while there's nothing to show. */
  disabled?: boolean;
}

/**
 * A card of more about what's hovered, such as a mod's thumbnail: its picture, title and
 * description, and a footer. A `Tooltip` in its beak and shadow, with a card's width and
 * layout, and the card and its beak tinted in its picture's colour.
 */
export const HoverCard = ({
  children,
  image,
  title,
  description,
  footer,
  disabled,
}: IHoverCardProps) => {
  const tint = useImageColour(image);

  return (
    <Tooltip
      className="nxm-hover-card-tooltip"
      customContent={
        <div className="nxm-hover-card">
          {!!image && (
            <div className="px-2">
              <Image
                alt=""
                className="w-full rounded-xs border border-stroke-weak"
                fallbackIconPath={mdiImageBroken}
                fit="cover"
                imageType="mod"
                src={image}
              />
            </div>
          )}

          <div className="flex flex-col gap-y-1 px-2">
            <p className="text-body-md font-semibold text-translucent-strong">{title}</p>

            {!!description && (
              <p
                className={joinClasses("text-body-sm", {
                  "text-neutral-subdued": !image,
                  "text-translucent-moderate": !!image,
                })}
              >
                {description}
              </p>
            )}
          </div>

          {!!footer && (
            <>
              <div className="h-px bg-stroke-weak" />

              <div className="flex items-center gap-x-2 px-2 text-body-sm text-translucent-subdued">
                {footer}
              </div>
            </>
          )}
        </div>
      }
      delay={DELAY}
      disabled={disabled}
      // Its left edge on the trigger's, so it never reaches back past the picture it's about.
      placement="top-start"
      style={tint ? ({ "--nxm-hover-card-tint": tint } as CSSProperties) : undefined}
    >
      {children}
    </Tooltip>
  );
};
