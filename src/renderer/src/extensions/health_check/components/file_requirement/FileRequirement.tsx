import {
  mdiCheckCircleOutline,
  mdiCloseCircleOutline,
  mdiFileOutline,
  mdiMonitorArrowDownVariant,
} from "@mdi/js";
import React, { type ReactNode } from "react";

import { Bullet } from "@/ui/components/bullet/Bullet";
import { Icon } from "@/ui/components/icon/Icon";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IFileRequirementData } from "../../utils/fileRequirements/cardHelpers";

interface IFileRequirementProps {
  actions?: ReactNode;
  file: IFileRequirementData;
  isOr?: boolean;
  /** Open the mod page (web). When set, the thumbnail and mod name become links. */
  onOpenMod?: () => void;
  /** Open the file page (web). When set, the file name becomes a link. */
  onOpenFile?: () => void;
}

export function FileRequirement({
  actions,
  file,
  isOr,
  onOpenMod,
  onOpenFile,
}: IFileRequirementProps) {
  const modImage = (
    <AdultAwareImage
      alt={file.modName}
      className="h-14 rounded-xs"
      imageType="mod"
      isAdult={file.adultContent}
      src={file.modImageSrc}
    />
  );

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
        {onOpenMod ? (
          <button className="shrink-0" type="button" onClick={onOpenMod}>
            {modImage}
          </button>
        ) : (
          modImage
        )}

        <div className="max-w-xl space-y-0.5">
          <div className="flex items-center gap-x-2">
            {onOpenMod ? (
              <button className="text-left hover:underline" type="button" onClick={onOpenMod}>
                <Typography appearance="moderate">{file.modName}</Typography>
              </button>
            ) : (
              <Typography appearance="moderate">{file.modName}</Typography>
            )}

            {file.adultContent && (
              <>
                <Bullet />

                <Typography brand="danger" typographyType="body-sm">
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

          {onOpenFile ? (
            <button
              className="truncate text-left hover:underline"
              type="button"
              onClick={onOpenFile}
            >
              {file.fileName}
            </button>
          ) : (
            <div className="truncate">{file.fileName}</div>
          )}

          <div className="shrink-0">{file.fileVersion}</div>
        </Typography>

        <div className="flex items-center gap-x-2">
          {file.installed && (
            <>
              <Pill iconPath={mdiMonitorArrowDownVariant}>Installed</Pill>

              {file.enabled ? (
                <Pill iconPath={mdiCheckCircleOutline} pillType="success">
                  Enabled
                </Pill>
              ) : (
                <Pill iconPath={mdiCloseCircleOutline}>Disabled</Pill>
              )}
            </>
          )}

          {!!actions && <div className="w-px self-stretch bg-stroke-weak" />}

          {actions}
        </div>
      </div>

      {isOr && (
        <Typography
          appearance="moderate"
          as="div"
          brand="neutral-translucent"
          className="absolute -bottom-2 left-4.5 bg-surface-low px-3 font-semibold group-last/file:hidden"
          typographyType="body-sm"
        >
          or
        </Typography>
      )}
    </div>
  );
}
