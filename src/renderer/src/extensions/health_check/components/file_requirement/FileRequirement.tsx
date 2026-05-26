import {
  mdiCheckCircleOutline,
  mdiCloseCircleOutline,
  mdiFileOutline,
  mdiMonitorArrowDownVariant,
} from "@mdi/js";
import React, { useState, type ReactNode } from "react";

import { Bullet } from "@/ui/components/bullet/Bullet";
import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

// TODO: replace with the real shape once the data source is wired up
export interface IFileRequirementData {
  adultContent: boolean;
  modName: string;
  modDescription: string;
  modImageSrc: string;
  fileName: string;
  fileVersion: string;
}

interface IFileRequirementProps {
  actions?: ReactNode;
  file: IFileRequirementData;
  isOr?: boolean;
}

export function FileRequirement({ actions, file, isOr }: IFileRequirementProps) {
  // todo get this value
  const [isFileEnabled] = useState(() => Math.random() < 0.5);

  return (
    <div
      className={joinClasses([
        "group/file relative",
        isOr
          ? "border-b-stroke-weak not-last:mb-6 not-last:border-b not-last:pb-6"
          : "not-last:mb-4",
      ])}
    >
      <div className="mb-px flex items-center gap-x-4 rounded-t-sm bg-surface-mid p-2">
        <AdultAwareImage
          alt={file.modName}
          className="h-14 rounded-xs"
          imageType="mod"
          isAdult={file.adultContent}
          src={file.modImageSrc}
        />

        <div className="max-w-xl space-y-0.5">
          <div className="flex items-center gap-x-2">
            <Typography appearance="moderate">{file.modName}</Typography>

            {file.adultContent && (
              <>
                <Bullet />

                <Typography
                  appearance="none"
                  className="text-danger-strong"
                  typographyType="body-sm"
                >
                  Adult
                </Typography>
              </>
            )}
          </div>

          <Typography appearance="subdued" className="line-clamp-2" typographyType="body-sm">
            {file.modDescription}
          </Typography>
        </div>
      </div>

      <div className="flex items-center justify-between gap-x-2 rounded-b-sm bg-surface-mid px-4 py-3">
        <Typography
          appearance="subdued"
          as="div"
          className="flex min-w-0 items-center gap-x-1.5"
          typographyType="body-sm"
        >
          <Icon path={mdiFileOutline} size="sm" />

          <div className="truncate">{file.fileName}</div>

          <div className="shrink-0">{file.fileVersion}</div>
        </Typography>

        <div className="flex items-center gap-x-2">
          {/* todo make these pills work */}
          <Pill iconPath={mdiMonitorArrowDownVariant}>Installed</Pill>

          {isFileEnabled ? (
            <Pill iconPath={mdiCheckCircleOutline} pillType="success">
              Enabled
            </Pill>
          ) : (
            <Pill iconPath={mdiCloseCircleOutline}>Disabled</Pill>
          )}

          {!!actions && <div className="w-px self-stretch bg-stroke-weak" />}

          {actions}
        </div>
      </div>

      {isOr && (
        <Typography
          appearance="moderate"
          as="div"
          className="absolute -bottom-2 left-4.5 bg-surface-low px-3 font-semibold group-last/file:hidden"
          isTranslucent={true}
          typographyType="body-sm"
        >
          or
        </Typography>
      )}
    </div>
  );
}
