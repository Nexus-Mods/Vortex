/**
 * Pill Demo Component
 * Demonstrates the Pill component variants and features
 */

import { mdiCheck, mdiCheckCircleOutline, mdiClose, mdiStar, mdiTag } from "@mdi/js";
import React, { useState, type ComponentProps } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

import { Pill } from "./Pill";

type PillType = NonNullable<ComponentProps<typeof Pill>["pillType"]>;

/**
 * Styled pill variants showcased in the demo. The `none` variant is intentionally
 * omitted here (it opts out of styling) and is demonstrated separately above.
 * Add new variants to this list as they are introduced.
 */
const VARIANTS: Array<{ pillType: PillType; label: string; iconPath?: string }> = [
  { pillType: "default", label: "Default", iconPath: mdiTag },
  { pillType: "success", label: "Success", iconPath: mdiCheckCircleOutline },
];

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

          <Pill pillType="none">Unstyled (none)</Pill>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Variants
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Each styled variant is selected with the <code>pillType</code> prop. More variants will be
          added over time.
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          {VARIANTS.map(({ pillType, label, iconPath }) => (
            <Pill iconPath={iconPath} key={pillType} pillType={pillType}>
              {label}
            </Pill>
          ))}
        </div>
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
