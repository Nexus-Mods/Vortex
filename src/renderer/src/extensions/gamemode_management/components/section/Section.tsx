import React, { forwardRef, type CSSProperties, type ReactNode } from "react";

import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface ISectionProps {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  count: string;
  description?: string;
  style?: CSSProperties;
  testId?: string;
  title: string;
}

/**
 * A titled band of the Games page: a header strip with the section name, its
 * count and any actions, followed by the section's content.
 */
export const Section = forwardRef<HTMLDivElement, ISectionProps>(
  ({ title, count, description, actions, children, className, style, testId }, ref) => (
    <section
      className={joinClasses(["border-stroke-weak not-last:border-b", className])}
      data-testid={testId}
      ref={ref}
      style={style}
    >
      <div className="flex flex-col gap-y-0.5 px-6 py-3">
        <div className="flex items-center gap-x-2">
          <Typography
            appearance="moderate"
            as="div"
            className="flex items-center gap-x-2 font-semibold"
          >
            <span>{title}</span>

            <span className="text-neutral-subdued">{count}</span>
          </Typography>

          {!!actions && <div className="ml-auto flex items-center">{actions}</div>}
        </div>

        {!!description && (
          <Typography appearance="subdued" typographyType="body-sm">
            {description}
          </Typography>
        )}
      </div>

      {!!children && <div className="px-6 pt-1 pb-6">{children}</div>}
    </section>
  ),
);

Section.displayName = "Section";
