import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Pill } from "@/ui/components/pill/Pill";
import { mdiUnfoldMoreVertical } from "@/ui/icon-paths";

/** One side of a comparison, with the server's blurred version where it sends one. */
export interface ICompareSliderPicture {
  src: string;
  blurredSrc?: string | null;
}

interface ICompareSliderProps {
  /** The picture without the mod, shown left of the divider. */
  before: ICompareSliderPicture;
  /** The picture with the mod, shown right of the divider. */
  after: ICompareSliderPicture;
  /** Blurs both pictures for a user who hasn't opted into adult content. */
  isAdult: boolean;
}

/**
 * A before/after comparison, styled as the site's slider: the after picture in a 16:9 frame, with
 * the before picture over it as far as a divider the user drags, each side labelled. The divider
 * is a range input stretched over both pictures and drawn invisible, so a click or drag anywhere
 * moves it there, Tab reaches it, the arrow keys move it, and screen readers announce it. It moves
 * as it's told to, with nothing animated, so it needs nothing for reduced motion.
 */
export const CompareSlider = ({ before, after, isAdult }: ICompareSliderProps) => {
  const { t } = useTranslation();
  const [position, setPosition] = useState(50);

  const picture = ({ src, blurredSrc }: ICompareSliderPicture, alt: string) => (
    <AdultAwareImage
      alt={alt}
      blurredSrc={blurredSrc}
      className="w-full rounded-sm"
      imageType="mod"
      isAdult={isAdult}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={src}
    />
  );

  return (
    <div className="relative [overflow-anchor:none]">
      {picture(after, t("After"))}

      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        {picture(before, t("Before"))}
      </div>

      <input
        aria-label={t("Before and after comparison")}
        aria-valuetext={t("{{before}}% before, {{after}}% after", {
          before: position,
          after: 100 - position,
        })}
        className="peer absolute inset-0 size-full cursor-ew-resize appearance-none opacity-0 [&::-webkit-slider-thumb]:size-px [&::-webkit-slider-thumb]:appearance-none"
        max={100}
        min={0}
        type="range"
        value={position}
        onChange={(event) => setPosition(event.target.valueAsNumber)}
      />

      <Pill appearance="scrim" className="pointer-events-none absolute bottom-2.5 left-2.5">
        {t("Before")}
      </Pill>

      <Pill appearance="scrim" className="pointer-events-none absolute right-2.5 bottom-2.5">
        {t("After")}
      </Pill>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 flex w-0.5 -translate-x-1/2 items-center justify-center bg-translucent-600 shadow-md peer-focus-visible:*:outline-2 peer-focus-visible:*:outline-focus-subdued"
        style={{ left: `${position}%` }}
      >
        <span className="flex shrink-0 items-center justify-center rounded-full border border-stroke-moderate bg-surface-mid p-1 text-neutral-strong shadow-md">
          <Icon path={mdiUnfoldMoreVertical} size="lg" />
        </span>
      </div>
    </div>
  );
};
