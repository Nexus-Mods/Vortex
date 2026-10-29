import React from "react";

import { useIsAdultBlurred } from "@/ui/components/image/useIsAdultBlurred.hook";

interface IModBackdropProps {
  /** The picture picked in the open mod's gallery; without one, only the dither. */
  src?: string;
  /** The same picture, blurred by the server, shown instead when adult content is to be blurred. */
  blurredSrc?: string;
  /** Whether the open mod is adult content. */
  isAdult: boolean;
}

/**
 * What lies under Browse's mod list and details: the open mod's picture, blurred, fading from the
 * top right and dimming as the details scroll, over a dither. Adult pictures are blurred by the
 * server unless the user has opted into them. Fills its positioned, clipping parent.
 */
export const ModBackdrop = ({ src, blurredSrc, isAdult }: IModBackdropProps) => {
  const shown = useIsAdultBlurred(isAdult) ? blurredSrc : src;

  return (
    <>
      {!!shown && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-3 left-[15%] -z-10 aspect-video w-[90%] backdrop-image-dim backdrop-image-fade"
        >
          <img alt="" className="size-full scale-110 object-cover blur-2xl" src={shown} />
        </div>
      )}

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dither" />
    </>
  );
};
