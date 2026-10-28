import React from "react";

interface IModBackdropProps {
  /** The picture picked in the open mod's gallery; without one, only the dither. */
  src?: string;
}

/**
 * What lies under Browse's mod list and details: the picture picked in the open mod's gallery,
 * blurred on its own so the game art's saturation doesn't reach it, held top right and fading out
 * towards the list, and a dither over it against the banding its fade shows. Fills its parent,
 * which has to be positioned and clip it, under that parent's other content.
 */
export const ModBackdrop = ({ src }: IModBackdropProps) => (
  <>
    {!!src && (
      <div
        aria-hidden
        className="pointer-events-none absolute -top-3 left-[15%] -z-10 aspect-video w-[90%] backdrop-image-fade"
      >
        <img alt="" className="size-full scale-110 object-cover blur-2xl" src={src} />
      </div>
    )}

    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dither" />
  </>
);
