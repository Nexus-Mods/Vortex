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
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { joinClasses } from "@/ui/utils/joinClasses";

import type { IFileRequirementData } from "../../utils/fileRequirements/cardHelpers";

interface IFileRequirementProps {
  actions?: ReactNode;
  file: IFileRequirementData;
  isOr?: boolean;
  showMod?: boolean;
  /** Open the mod page (web). When set, the thumbnail and mod name become links. */
  onOpenMod?: () => void;
  /** Open the file page (web). When set, the file name becomes a link. */
  onOpenFile?: () => void;
}

export function FileRequirement({
  actions,
  file,
  isOr,
  showMod = true,
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
        "group/file relative px-6",
        isOr ? "not-last:mb-8 not-last:pb-8" : "not-last:mb-4",
      ])}
    >
      {showMod && (
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
                <TypographyLink appearance="moderate" variant="secondary" onClick={onOpenMod}>
                  {file.modName}
                </TypographyLink>
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
      )}

      <div
        className={joinClasses([
          "flex items-center justify-between gap-x-12 bg-surface-mid px-4 py-3",
          showMod ? "rounded-b-sm" : "rounded-sm",
        ])}
      >
        <Typography
          appearance="subdued"
          as="div"
          className="flex min-w-0 items-center gap-x-1.5"
          typographyType="body-sm"
        >
          <Icon path={mdiFileOutline} size="sm" />

          {onOpenFile ? (
            <TypographyLink
              appearance="subdued"
              className="min-w-0"
              customContent={<span className="truncate">{file.fileName}</span>}
              typographyType="inherit"
              variant="secondary"
              onClick={onOpenFile}
            />
          ) : (
            <div className="truncate">{file.fileName}</div>
          )}

          <Bullet />

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

              {!!actions && <div className="w-px self-stretch bg-stroke-weak" />}
            </>
          )}

          {actions}
        </div>
      </div>

      {isOr && (
        <div
          aria-hidden
          className="absolute inset-x-0 -bottom-2 flex h-5 items-center gap-x-3 group-last/file:hidden"
        >
          <div className="h-px w-3 bg-surface-mid" />

          <Typography as="div" className="font-semibold">
            Or
          </Typography>

          <div className="h-px grow bg-surface-mid" />
        </div>
      )}
    </div>
  );
}
