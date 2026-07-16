import { mdiChevronDown } from "@mdi/js";
import React, { forwardRef, type ReactNode, useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface ICollapsibleSectionProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export const CollapsibleSection = forwardRef<HTMLDivElement, ICollapsibleSectionProps>(
  ({ title, actions, children, defaultExpanded = true, className }, ref) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const toggle = () => setExpanded((prev) => !prev);

    return (
      <div className={joinClasses(["border-t border-stroke-weak", className])}>
        <div
          aria-expanded={expanded}
          className="flex cursor-pointer items-center justify-between gap-x-2 px-6 py-3 transition-colors hover:bg-surface-mid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info-subdued"
          ref={ref}
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(event) => {
            if (["Enter", " "].includes(event.key)) {
              event.preventDefault();
              toggle();
            }
          }}
        >
          <div className="flex items-center gap-x-2">
            <Icon
              className={joinClasses("transition-transform", { "rotate-180": expanded })}
              path={mdiChevronDown}
            />

            <Typography as="span" className="font-semibold">
              {title}
            </Typography>
          </div>

          {!!actions && (
            <div role="presentation" onClick={(evt) => evt.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>

        {expanded && <div className="pt-3 pr-6 pb-6 pl-13">{children}</div>}
      </div>
    );
  },
);

CollapsibleSection.displayName = "CollapsibleSection";
