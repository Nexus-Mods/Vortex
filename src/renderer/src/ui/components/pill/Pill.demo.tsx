/**
 * Pill Demo Component
 * Demonstrates the Pill component variants and features
 */

import { mdiCheck, mdiCheckCircleOutline, mdiClose, mdiStar, mdiTag } from "@mdi/js";
import React, { useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IPillAppearance, IPillBrand } from "./Pill";
import { Pill } from "./Pill";

const BRANDS: IPillBrand[] = [
  "neutral",
  "light",
  "primary",
  "info",
  "success",
  "danger",
  "warning",
  "premium",
];

/**
 * `none` is left out: it opts out of the treatment rather than being one, and is shown
 * on its own below.
 */
const APPEARANCES: IPillAppearance[] = ["subdued", "scrim"];

export const PillDemo = () => {
  const [clicks, setClicks] = useState(0);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Pill
        </Typography>

        <Typography appearance="subdued">
          A compact, rounded label used for tags and statuses. Renders as a non-interactive div by
          default, or as a button when given <code>as="button"</code>.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Default Pills
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Pill>Default</Pill>

          <Pill appearance="none">Unstyled (none)</Pill>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Brand × Appearance
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          <code>brand</code> tints the icon and nothing else, so every row needs one to show its
          colour. <code>appearance</code> carries the treatment — <code>scrim</code> paints a scrim
          fill of its own and takes its achromatic colours from the fixed Scrim families, so it is
          shown here on a bright ground as it would sit over artwork.
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          These are rendered <code>as="button"</code> so the hover and focus states can be seen.
          Subdued washes a fill in on a <code>:before</code> overlay, while scrim firms its border
          up instead; both are gated behind <code>:enabled</code>, so a plain <code>div</code> pill
          never shows either. Each row ends with a disabled pill, which drops to 40% opacity and
          takes no state at all.
        </Typography>

        {APPEARANCES.map((appearance) => (
          <div className="space-y-2" key={appearance}>
            <Typography appearance="subdued" typographyType="body-sm">
              <code>{appearance}</code>
            </Typography>

            {/* scrim paints its own, so it is shown on a bright ground */}
            <div
              className={joinClasses(["flex flex-wrap items-center gap-4 rounded-sm p-3"], {
                "bg-surface-inverted": appearance === "scrim",
              })}
            >
              {BRANDS.map((brand) => (
                <Pill
                  appearance={appearance}
                  as="button"
                  brand={brand}
                  iconPath={mdiCheckCircleOutline}
                  key={brand}
                >
                  {brand}
                </Pill>
              ))}

              {/* Closes each row so the disabled treatment can be read against both grounds */}
              <Pill
                appearance={appearance}
                as="button"
                disabled={true}
                iconPath={mdiCheckCircleOutline}
              >
                disabled
              </Pill>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Pills with Icons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Pill iconPath={mdiTag}>Tagged</Pill>

          <Pill iconPath={mdiCheck}>Verified</Pill>

          <Pill icon={<Icon path={mdiStar} size="none" />}>Custom icon node</Pill>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Button Pills
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {`Clicked ${clicks} ${clicks === 1 ? "time" : "times"}.`}
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Pill as="button" onClick={() => setClicks((count) => count + 1)}>
            Clickable
          </Pill>

          <Pill as="button" iconPath={mdiClose} onClick={() => setClicks((count) => count + 1)}>
            With icon
          </Pill>

          <Pill as="button" disabled={true}>
            Disabled
          </Pill>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Disabled Appearance
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          A non-interactive pill can opt into the disabled styling with the nxm-pill-disabled class.
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Pill className="nxm-pill-disabled">Disabled</Pill>
        </div>
      </div>
    </div>
  );
};
