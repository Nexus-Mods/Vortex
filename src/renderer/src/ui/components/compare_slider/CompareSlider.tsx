import React, { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Pill } from "@/ui/components/pill/Pill";

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
  /** What the comparison shows, such as its author's title, named in each picture's alt text. */
  title?: string;
  /** Gives each picture a frame's background, border and corners, as the gallery's have. */
  isStyled?: boolean;
}

/**
 * A before/after comparison, styled as the site's slider: the after picture in a 16:9 frame, with
 * the before picture over it as far as a divider the user drags, each side labelled. The divider
 * is a range input stretched over both pictures and drawn invisible, so a click or drag anywhere
 * moves it there, Tab reaches it, the arrow keys move it, and screen readers announce it. It moves
 * as it's told to, with nothing animated, so it needs nothing for reduced motion. Its styles are
 * `.nxm-compare-slider`'s, so utilities can override them.
 */
export const CompareSlider = ({
  before,
  after,
  isAdult,
  title,
  isStyled = true,
}: ICompareSliderProps) => {
  const { t } = useTranslation();
  const [position, setPosition] = useState(50);

  const picture = ({ src, blurredSrc }: ICompareSliderPicture, alt: string) => (
    <AdultAwareImage
      alt={alt}
      blurredSrc={blurredSrc}
      className="nxm-compare-slider-picture"
      imageType="mod"
      isAdult={isAdult}
      isStyled={isStyled}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={src}
    />
  );

  return (
    <div
      className="nxm-compare-slider"
      style={{ "--nxm-compare-slider-position": `${position}` } as CSSProperties}
    >
      <div
        className="nxm-compare-slider-after"
        data-testid="compare-slider-after"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        {picture(after, t(title ? "{{title}}, after" : "After", { title }))}
      </div>

      <div
        className="nxm-compare-slider-before"
        data-testid="compare-slider-before"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {picture(before, t(title ? "{{title}}, before" : "Before", { title }))}
      </div>

      <input
        aria-label={t("Before and after comparison")}
        aria-valuetext={t("{{before}}% before, {{after}}% after", {
          before: position,
          after: 100 - position,
        })}
        className="nxm-compare-slider-input"
        max={100}
        min={0}
        type="range"
        value={position}
        onChange={(event) => setPosition(event.target.valueAsNumber)}
      />

      <Pill
        appearance="scrim"
        className="nxm-compare-slider-label nxm-compare-slider-label-before"
        data-testid="compare-slider-before-label"
      >
        {t("Before")}
      </Pill>

      <Pill
        appearance="scrim"
        className="nxm-compare-slider-label nxm-compare-slider-label-after"
        data-testid="compare-slider-after-label"
      >
        {t("After")}
      </Pill>

      <div aria-hidden className="nxm-compare-slider-divider" style={{ left: `${position}%` }}>
        <span className="nxm-compare-slider-handle">
          {/* The font's `code` is the `< >` of the site's handle. */}
          <Icon name="code" size="lg" />
        </span>
      </div>
    </div>
  );
};
