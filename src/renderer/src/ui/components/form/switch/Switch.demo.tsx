/**
 * SwitchDemo Component
 * Demonstrates the tri-state Switch: off / on / semi-on, an interactive
 * controlled example, and a "select all" master switch that derives its semi-on
 * (mixed) state from its children.
 */

import React, { useState } from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { Switch } from "./Switch";

const CHILD_LABELS = ["Auto-update", "Notifications", "Telemetry"];

export const SwitchDemo = () => {
  const [enabled, setEnabled] = useState(true);
  const [children, setChildren] = useState<boolean[]>([true, false, false]);

  const allOn = children.every(Boolean);
  const noneOn = !children.some(Boolean);

  const setChild = (index: number, value: boolean) =>
    setChildren((current) => current.map((on, i) => (i === index ? value : on)));

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h3" typographyType="heading-xs">
          Switch
        </Typography>

        <Typography appearance="subdued">
          A tri-state switch: off, on, and a programmatic semi-on (reported to assistive tech as
          aria-checked=&quot;mixed&quot;). Clicking only flips between on and off — semi-on is set
          by a pre-existing state, such as a master control whose children are partially enabled.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          States
        </Typography>

        <div className="grid w-max grid-cols-[auto_auto_auto] items-center gap-x-8 gap-y-3">
          <span />
          <Typography appearance="subdued" typographyType="body-sm">
            Enabled
          </Typography>
          <Typography appearance="subdued" typographyType="body-sm">
            Disabled
          </Typography>

          <Typography appearance="subdued" typographyType="body-sm">
            Off
          </Typography>
          <Switch aria-label="Off, enabled" checked={false} onChange={() => undefined} />
          <Switch aria-label="Off, disabled" checked={false} disabled={true} />

          <Typography appearance="subdued" typographyType="body-sm">
            On
          </Typography>
          <Switch aria-label="On, enabled" checked={true} onChange={() => undefined} />
          <Switch aria-label="On, disabled" checked={true} disabled={true} />

          <Typography appearance="subdued" typographyType="body-sm">
            Semi-on
          </Typography>
          <Switch aria-label="Semi-on, enabled" indeterminate={true} onChange={() => undefined} />
          <Switch aria-label="Semi-on, disabled" disabled={true} indeterminate={true} />
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Interactive
        </Typography>

        <div className="flex w-max items-center gap-3">
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />

          <Typography as="span" typographyType="body-sm">
            {enabled ? "Enabled" : "Disabled"}
          </Typography>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h4" typographyType="heading-xs">
          Semi-on from children (&quot;select all&quot;)
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          The master switch is semi-on when some — but not all — children are on. Clicking it turns
          everything on, or off when already fully on.
        </Typography>

        <div className="flex w-max items-center gap-3">
          <Switch
            checked={allOn}
            indeterminate={!allOn && !noneOn}
            onChange={(e) => setChildren(children.map(() => e.target.checked))}
          />

          <Typography as="span" typographyType="body-sm">
            All settings
          </Typography>
        </div>

        <div className="ml-6 space-y-2">
          {CHILD_LABELS.map((label, index) => (
            <div className="flex w-max items-center gap-3" key={label}>
              <Switch
                checked={children[index]}
                onChange={(e) => setChild(index, e.target.checked)}
              />

              <Typography as="span" typographyType="body-sm">
                {label}
              </Typography>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
