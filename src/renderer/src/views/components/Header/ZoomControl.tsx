import React from "react";

import { Popover } from "@/ui/components/popover/Popover";

import { ZoomPopover } from "./ZoomPopover";

export function ZoomControl() {
  return (
    <Popover
      className="relative h-7 w-0 shrink-0 transition-[width] has-[[data-zoom-visible=true]]:w-9"
      data-testid="zoom-control-slot"
      style={{ WebkitAppRegion: "no-drag" }}
    >
      {({ close, open }) => <ZoomPopover close={close} open={open} />}
    </Popover>
  );
}
