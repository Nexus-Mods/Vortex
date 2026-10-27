import React, { useLayoutEffect, useRef, useState } from "react";

import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

/**
 * A requirement's note from its mod's author, cut to two lines. Authors write anything from one
 * word to a sentence, so one that's cut off shows in full in a tooltip.
 */
export const RequirementNote = ({ notes }: { notes: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current?.firstElementChild;
    if (element === null || element === undefined) {
      return undefined;
    }
    const measure = () => setIsClamped(element.scrollHeight > element.clientHeight);
    measure();
    // the dialog's width, so where the note wraps, can change while it's open
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [notes]);

  return (
    // Typography takes no ref, so the tooltip and the measuring hold the box around it.
    <Tooltip content={notes} disabled={!isClamped}>
      <div ref={ref}>
        <Typography
          appearance="weak"
          as="div"
          className="line-clamp-2 whitespace-pre-line"
          typographyType="body-xs"
        >
          {notes}
        </Typography>
      </div>
    </Tooltip>
  );
};
