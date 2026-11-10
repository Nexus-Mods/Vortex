import React, { useCallback, useState } from "react";

import { useIsAdultBlurred } from "@/ui/components/image/useIsAdultBlurred.hook";
import { joinClasses } from "@/ui/utils/joinClasses";

interface IModBackdropProps {
  /** The picture picked in the open mod's gallery; without one, only the dither. */
  src?: string | null;
  /** The same picture, blurred by the server, shown instead when adult content is to be blurred. */
  blurredSrc?: string | null;
  /** Whether the open mod is adult content. */
  isAdult: boolean;
}

/** A picture in the backdrop's stack; a picture shown again is a new one, to fade in afresh. */
interface IBackdropPicture {
  id: number;
  src: string;
}

interface IBackdropPictureProps {
  /** Where the picture is. */
  src: string;
  /** Told once it has faded in, so the pictures under it can go. */
  onShown: () => void;
}

/**
 * One picture in the backdrop: unseen until it has loaded, then faded in over those below it, over
 * 300ms, slower than the default for so large a change. One already loaded when it's added, from
 * the cache, fades in from its starting style instead. Reduced motion all but drops the fade, but
 * not to 0s, which would end no transition to let the pictures below go.
 */
const BackdropPicture = ({ src, onShown }: IBackdropPictureProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const settleIfComplete = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && !!image.naturalWidth) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <img
      alt=""
      className={joinClasses(
        "absolute inset-0 size-full scale-110 object-cover blur-2xl transition-opacity duration-300 starting:opacity-0 reduce-motion:duration-[0.01ms]",
        { "opacity-0": !isLoaded },
      )}
      ref={settleIfComplete}
      src={src}
      onLoad={() => setIsLoaded(true)}
      onTransitionEnd={onShown}
    />
  );
};

/**
 * What lies under Browse's mod list and details: the open mod's picture, blurred, fading from the
 * top right and dimming as the details scroll, over a dither. Adult pictures are blurred by the
 * server unless the user has opted into them. Another picture fades in over the last once it has
 * loaded, and the last goes when it has. Fills its positioned, clipping parent.
 */
export const ModBackdrop = ({ src, blurredSrc, isAdult }: IModBackdropProps) => {
  const shown = useIsAdultBlurred(isAdult) ? blurredSrc : src;
  const [pictures, setPictures] = useState<IBackdropPicture[]>(() =>
    shown ? [{ id: 0, src: shown }] : [],
  );
  const top = pictures.at(-1);

  if (!shown && pictures.length > 0) {
    setPictures([]);
  } else if (shown && top?.src !== shown) {
    setPictures([...pictures, { id: (top?.id ?? 0) + 1, src: shown }]);
  }

  /** Lets go of the pictures under one that has faded in. */
  const dropBelow = (id: number) =>
    setPictures((previous) => previous.slice(previous.findIndex((picture) => picture.id === id)));

  return (
    <>
      {!!pictures.length && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-3 left-[15%] -z-10 aspect-video w-[90%] backdrop-image-dim backdrop-image-fade"
        >
          {pictures.map((picture) => (
            <BackdropPicture
              key={picture.id}
              src={picture.src}
              onShown={() => dropBelow(picture.id)}
            />
          ))}
        </div>
      )}

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dither" />
    </>
  );
};
