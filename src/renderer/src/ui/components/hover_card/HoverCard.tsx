import React, { type CSSProperties, type ReactNode } from "react";

import { Image } from "@/ui/components/image/Image";
import { useImageColour } from "@/ui/components/image/useImageColour.hook";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

/** Longer to open than a tooltip, so sweeping down a list doesn't flash a card on every row. */
const DELAY = { close: 50, open: 500 };

interface IHoverCardProps {
  /** The trigger, such as a picture; the card wraps it, so it needn't take a ref. */
  children: ReactNode;
  /** Its picture, whose colour tints the card; unset, the fallback icon stands in, untinted. */
  image?: string;
  /** Lays the card out: a mod's picture across its top, a collection's beside it. Default `mod`. */
  imageType?: "mod" | "collection";
  /** What it's about, such as a mod page's title. */
  title: string;
  /** A line or two more about it, such as a mod page's short description. */
  description?: string;
  /** What runs along its foot, under a rule, such as the author and the size. */
  footer?: ReactNode;
  /** Renders the trigger alone, with no card, such as while there's nothing to show. */
  disabled?: boolean;
}

/** The card's picture, in a frame of its kind's shape. */
const HoverCardImage = ({
  src,
  imageType,
}: {
  src: string | undefined;
  imageType: "mod" | "collection";
}) => (
  <Image
    alt=""
    className={joinClasses("shrink-0 rounded-xs", {
      "h-44": imageType === "collection",
      "w-full": imageType === "mod",
    })}
    fallbackIcon="broken_image"
    fit="cover"
    imageType={imageType}
    src={src}
  />
);

/** The card's title, and its description under it, lighter on a tinted card. */
const HoverCardText = ({
  title,
  description,
  tinted,
}: {
  title: string;
  description?: string;
  tinted: boolean;
}) => (
  <>
    <Typography brand="neutral-translucent" className="font-semibold" typographyType="body-md">
      {title}
    </Typography>

    {!!description && (
      <Typography
        {...(tinted
          ? { brand: "neutral-translucent", appearance: "moderate" }
          : { appearance: "subdued" })}
        typographyType="body-sm"
      >
        {description}
      </Typography>
    )}
  </>
);

const HoverCardRule = () => <div className="h-px shrink-0 bg-stroke-weak" />;

const HoverCardFooter = ({ children }: { children: ReactNode }) => (
  <Typography
    appearance="subdued"
    as="div"
    brand="neutral-translucent"
    className="flex items-center gap-x-2"
    typographyType="body-sm"
  >
    {children}
  </Typography>
);

/**
 * A card of more about what's hovered, such as a mod's thumbnail: its picture, title and
 * description, and a footer. A `Tooltip` in its beak and shadow, with a card's width and
 * layout, and the card and its beak tinted in its picture's colour.
 */
export const HoverCard = ({
  children,
  image,
  imageType = "mod",
  title,
  description,
  footer,
  disabled,
}: IHoverCardProps) => {
  const tint = useImageColour(image);
  const tinted = !!image;

  const content =
    imageType === "collection" ? (
      <div className="nxm-hover-card nxm-hover-card-collection">
        <div className="flex gap-x-3">
          <HoverCardImage imageType={imageType} src={image} />

          <div className="flex min-w-0 flex-1 flex-col gap-y-2">
            <div className="flex flex-1 flex-col gap-y-1">
              <HoverCardText description={description} tinted={tinted} title={title} />
            </div>

            {!!footer && <HoverCardRule />}
          </div>
        </div>

        {!!footer && <HoverCardFooter>{footer}</HoverCardFooter>}
      </div>
    ) : (
      <div className="nxm-hover-card">
        <div className="px-2">
          <HoverCardImage imageType={imageType} src={image} />
        </div>

        <div className="flex flex-col gap-y-1 px-2">
          <HoverCardText description={description} tinted={tinted} title={title} />
        </div>

        {!!footer && (
          <>
            <HoverCardRule />

            <div className="px-2">
              <HoverCardFooter>{footer}</HoverCardFooter>
            </div>
          </>
        )}
      </div>
    );

  return (
    <Tooltip
      className="nxm-hover-card-tooltip"
      customContent={content}
      delay={DELAY}
      disabled={disabled}
      placement="top-start"
      style={tint ? ({ "--nxm-hover-card-tint": tint } as CSSProperties) : undefined}
    >
      <span className="inline-flex shrink-0">{children}</span>
    </Tooltip>
  );
};
