/**
 * Image Demo Component
 * Demonstrates the Image component aspect ratios, blur and error fallback
 */

import React from "react";

import { Typography } from "../typography/Typography";
import { AdultAwareImage } from "./AdultAwareImage";
import type { IImageProps } from "./Image";
import { Image } from "./Image";

const imageTypes: {
  className: string;
  correctSrc: string;
  imageType: NonNullable<IImageProps["imageType"]>;
  incorrectSrc: string;
  ratio: string;
}[] = [
  {
    imageType: "collection",
    ratio: "4 / 5 (portrait)",
    className: "w-40",
    correctSrc: "https://picsum.photos/seed/collection/400/500",
    incorrectSrc: "https://picsum.photos/seed/collection/500/280",
  },
  {
    imageType: "mod",
    ratio: "16 / 9 (landscape)",
    className: "w-56",
    correctSrc: "https://picsum.photos/seed/mod/480/270",
    incorrectSrc: "https://picsum.photos/seed/mod/300/400",
  },
  {
    imageType: "other",
    ratio: "none (sized by container)",
    className: "h-40 w-48",
    correctSrc: "https://picsum.photos/seed/other/360/300",
    incorrectSrc: "https://picsum.photos/seed/other/200/400",
  },
];

export const ImageDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Image
      </Typography>

      <Typography appearance="subdued">
        An image wrapper with predefined aspect ratios, optional blur, and a fallback icon shown
        when the source fails to load.
      </Typography>
    </div>

    <div className="space-y-6">
      <div>
        <Typography as="h3" typographyType="heading-xs">
          Image Types
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Each type enforces an aspect ratio on the container. A source matching that ratio fills
          the frame; a mismatched source is centred and letterboxed within it.
        </Typography>
      </div>

      {imageTypes.map(({ className, correctSrc, imageType, incorrectSrc, ratio }) => (
        <div className="space-y-2" key={imageType}>
          <Typography typographyType="body-sm">
            <span className="font-semibold">{imageType}</span> — {ratio}
          </Typography>

          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col items-center gap-2">
              <Image
                alt={`${imageType} with matching aspect`}
                className={className}
                imageType={imageType}
                src={correctSrc}
              />

              <Typography appearance="subdued" typographyType="body-xs">
                Matching aspect
              </Typography>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Image
                alt={`${imageType} with mismatched aspect`}
                className={className}
                imageType={imageType}
                src={incorrectSrc}
              />

              <Typography appearance="subdued" typographyType="body-xs">
                Mismatched aspect
              </Typography>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Blurred
      </Typography>

      <Image
        isBlurred
        alt="Blurred example"
        className="w-48"
        imageType="collection"
        src="https://picsum.photos/seed/blurred/300/200"
      />
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Adult-aware
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        <span className="font-semibold">AdultAwareImage</span> wraps Image for Nexus content. When{" "}
        <span className="font-semibold">isAdult</span> is set it blurs according to the logged-in
        user&apos;s <span className="font-semibold">adultBlurImages</span> preference, and blurs by
        default when no one is logged in or the preference is unknown. Non-adult images are never
        blurred. (Whether the example below shows blurred depends on your account preference.)
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex flex-col items-center gap-2">
          <AdultAwareImage
            isAdult
            alt="Adult content example"
            className="w-48"
            imageType="collection"
            src="https://picsum.photos/seed/adult/300/375"
          />

          <Typography appearance="subdued" typographyType="body-xs">
            isAdult (blur depends on preference)
          </Typography>
        </div>

        <div className="flex flex-col items-center gap-2">
          <AdultAwareImage
            alt="Non-adult content example"
            className="w-48"
            imageType="collection"
            isAdult={false}
            src="https://picsum.photos/seed/safe/300/375"
          />

          <Typography appearance="subdued" typographyType="body-xs">
            Not adult (never blurred)
          </Typography>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Error Fallback
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        When the source fails to load, a broken-image icon is shown in its place.
      </Typography>

      <Image
        alt="Broken image example"
        className="w-48"
        imageType="collection"
        src="https://invalid.example.com/does-not-exist.png"
      />
    </div>
  </div>
);
