import React, { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { joinClasses } from "@/ui/utils/joinClasses";

/** One picture in a mod's gallery. */
export interface IGalleryImage {
  /** The full-size picture, shown large. */
  src: string;
  /** The small one, for the strip. */
  thumbnail: string;
  /** What it shows, for screen readers; empty or absent when its author gave none. */
  title?: string;
}

/** How many thumbnails the strip fits; fewer pictures are made up with placeholders. */
const STRIP_LENGTH = 5;

/** How long each thumbnail waits after the one before it to fade in. */
const FADE_STAGGER_MS = 60;

/** A thumbnail's width, a fifth of the strip less its gaps. */
const THUMBNAIL_WIDTH = "w-[calc((100%-4*0.375rem)/5)]";

interface IModGalleryProps {
  /** The pictures, the first shown large to begin with. */
  images: IGalleryImage[];
  /** Blurs every picture for a user who hasn't opted into adult content. */
  isAdult: boolean;
  /** Pulses the placeholders, while more pictures are coming. */
  isLoading?: boolean;
  /** Told the picture now shown large, whenever another is picked. */
  onPick?: (image: IGalleryImage) => void;
}

/**
 * A mod's pictures: the picked one large, over a strip of them all that scrolls sideways, with
 * arrows at its ends while there's more to see. Clicking a thumbnail, or the arrow keys on the
 * strip, picks it. The strip always holds at least five slots, each a placeholder until its
 * thumbnail fades in over it, one after another; the empty ones pulse while more pictures load.
 */
export const ModGallery = ({ images, isAdult, isLoading, onPick }: IModGalleryProps) => {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const [picked, setPicked] = useState(0);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const updateCanScroll = () => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    setCanScroll({
      back: strip.scrollLeft > 0,
      forward: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
    });
  };

  useEffect(() => {
    const strip = stripRef.current;

    if (!strip) {
      return undefined;
    }

    const observer = new ResizeObserver(updateCanScroll);
    observer.observe(strip);

    return () => observer.disconnect();
  }, [images]);

  const pick = (index: number) => {
    setPicked(index);
    onPick?.(images[index]);
    thumbnailsRef.current[index]?.focus();
    thumbnailsRef.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const pickByKey = (event: KeyboardEvent) => {
    const next = { ArrowLeft: picked - 1, ArrowRight: picked + 1, Home: 0, End: images.length - 1 }[
      event.key
    ];

    if (next === undefined || next < 0 || next >= images.length) {
      return;
    }

    event.preventDefault();
    pick(next);
  };

  const page = (direction: 1 | -1) =>
    stripRef.current?.scrollBy({
      left: direction * stripRef.current.clientWidth,
      behavior: "smooth",
    });

  const shown = images[picked] ?? images[0];

  if (!shown && !isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-2">
      {shown ? (
        <AdultAwareImage
          alt={shown.title ?? ""}
          className="w-full rounded-sm"
          imageType="mod"
          isAdult={isAdult}
          isLoading={isLoading}
          src={isLoading ? undefined : shown.src}
        />
      ) : (
        <div
          aria-hidden
          data-gallery-placeholder
          className={joinClasses(["aspect-mod w-full rounded-sm bg-surface-translucent-mid"], {
            "animate-pulse": isLoading,
          })}
        />
      )}

      <div className="relative flex items-center">
        <div
          aria-label={t("Images")}
          className="-m-1 flex min-w-0 flex-1 snap-x scroll-px-1 scrollbar-none gap-x-1.5 overflow-x-auto p-1"
          ref={stripRef}
          role="toolbar"
          onKeyDown={pickByKey}
          onScroll={updateCanScroll}
        >
          {Array.from({ length: Math.max(STRIP_LENGTH, images.length) }, (_, index) => {
            const image = images[index];

            return (
              <div
                aria-hidden={!image || undefined}
                className={joinClasses(
                  [
                    THUMBNAIL_WIDTH,
                    "aspect-mod shrink-0 snap-start rounded-xs bg-surface-translucent-mid",
                  ],
                  { "animate-pulse": isLoading && !image },
                )}
                data-gallery-placeholder={!image || undefined}
                key={index}
              >
                {!!image && (
                  <button
                    aria-label={t("Image {{index}} of {{count}}", {
                      index: index + 1,
                      count: images.length,
                    })}
                    aria-pressed={index === picked}
                    className="block w-full animate-fade-in rounded-xs"
                    ref={(element) => (thumbnailsRef.current[index] = element)}
                    style={{
                      animationDelay: `${Math.min(index, STRIP_LENGTH - 1) * FADE_STAGGER_MS}ms`,
                    }}
                    tabIndex={index === picked ? 0 : -1}
                    type="button"
                    onClick={() => pick(index)}
                  >
                    <AdultAwareImage
                      alt=""
                      className={joinClasses(["w-full rounded-xs bg-transparent"], {
                        "[&_.nxm-image-frame]:border-neutral-strong": index === picked,
                      })}
                      imageType="mod"
                      isAdult={isAdult}
                      src={image.thumbnail}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {canScroll.back && (
          <Button
            appearance="scrim"
            brand="neutral"
            className="absolute left-1"
            leftIcon="chevron_left"
            size="sm"
            title={t("Earlier images")}
            onClick={() => page(-1)}
          />
        )}

        {canScroll.forward && (
          <Button
            appearance="scrim"
            brand="neutral"
            className="absolute right-1"
            leftIcon="chevron_right"
            size="sm"
            title={t("Later images")}
            onClick={() => page(1)}
          />
        )}
      </div>
    </div>
  );
};
