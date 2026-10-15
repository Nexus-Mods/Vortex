/**
 * MessageBox Demo Component
 * Demonstrates the box on its own, wrapping, and behind the show/hide toggle.
 */

import React from "react";

import { MessageBox } from "@/ui/components/message_box/MessageBox";
import { Typography } from "@/ui/components/typography/Typography";

const DETAILS =
  "Error: ENOENT: no such file or directory, open 'D:\\Games\\Vortex Mods\\stardewvalley\\mod.json'\n" +
  "    at readFile (fs.js:327:11)\n" +
  "    at installMod (installer.js:88:5)";

export const MessageBoxDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Message box
      </Typography>

      <Typography appearance="subdued">
        A read-only box for details such as an error message or a path. The text can be selected and
        copied, and the box scrolls once it grows past its maximum height.
      </Typography>
    </div>

    <div className="max-w-md">
      <MessageBox
        copyLabel="Copy message"
        hideLabel="Hide Details"
        isCollapsible={false}
        message={DETAILS}
        shouldWrap={false}
        showLabel="Show Details"
      />
    </div>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Wrapping, behind a toggle
      </Typography>

      <Typography appearance="subdued">
        Wrapping stops long lines scrolling sideways. A collapsible box starts closed, so the
        details stay out of the way until someone asks for them.
      </Typography>
    </div>

    <div className="max-w-md">
      <MessageBox
        copyLabel="Copy message"
        hideLabel="Hide Details"
        isCollapsible
        message={DETAILS}
        shouldWrap
        showLabel="Show Details"
      />
    </div>
  </div>
);
