import React from "react";
import { useTranslation } from "react-i18next";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import {
  friendlyDownloadName,
  isTempDownloadName,
} from "@/extensions/download_management/util/downloadNames";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { Typography } from "@/ui/components/typography/Typography";
import { timeToString } from "@/util/util";

import type { DownloadEta } from "./useDownloadEta.hook";

/** `modInfo.nexus` is untyped, and both fields land after the download itself. */
interface INexusModImagery {
  contains_adult_content?: boolean;
  picture_url?: string;
}

/**
 * Whether a thumbnail is on its way. `nexus.ids.modId` is what makes the metadata fetch
 * run at all, so without it no image is ever coming and the frame should stay empty
 * rather than sit there spinning — a manual download has no picture to wait for.
 */
const expectsImage = (download: IDownload | undefined): boolean =>
  download?.modInfo?.nexus?.ids?.modId !== undefined;

/** "08:06" reads like a stopwatch; the design asks for "8:06". */
export const formatRemaining = (seconds: number): string =>
  timeToString(Math.ceil(seconds)).replace(/^0(?=\d)/, "");

interface IDownloadFlyoutProps {
  download: IDownload | undefined;
  eta: DownloadEta;
  otherCount: number;
}

/**
 * What the spine's download button says when it announces a download: the file, how many
 * others are queued behind it, and how long it has left.
 *
 * Presentational: the download and its estimate are read by the button, which outlives
 * this panel.
 */
export const DownloadFlyout = ({ download, eta, otherCount }: IDownloadFlyoutProps) => {
  const { t } = useTranslation(["common"]);
  const name = download === undefined ? undefined : friendlyDownloadName(download);

  // The on-disk name is a __vortex_tmp_* placeholder until the download completes, so a
  // temp name means the metadata hasn't landed.
  const hasName = !!name && !isTempDownloadName(name);
  const nexusMod = download?.modInfo?.nexus?.modInfo as INexusModImagery | undefined;

  return (
    <div className="flex h-12.5 w-full items-start gap-x-2.5 p-2">
      <AdultAwareImage
        alt=""
        className="w-7.5 rounded-xs"
        imageType="mod"
        isAdult={nexusMod?.contains_adult_content ?? false}
        isLoading={expectsImage(download) && nexusMod?.picture_url === undefined}
        src={nexusMod?.picture_url}
      />

      <div className="flex min-w-0 grow flex-col gap-0.5">
        <Typography
          appearance="moderate"
          as="div"
          className="flex gap-x-2.5 font-semibold"
          typographyType="body-sm"
        >
          {hasName && (
            <div className="grow truncate" data-testid="download-flyout-name">
              {t("Downloading {{name}}", { replace: { name } })}
            </div>
          )}

          {!!otherCount && (
            <div className="shrink-0" data-testid="download-flyout-more">
              {t("+{{ count }} more", { count: otherCount })}
            </div>
          )}
        </Typography>

        {eta.status !== "unavailable" && (
          <Typography
            appearance="subdued"
            as="span"
            data-testid={
              eta.status === "ready" ? "download-flyout-remaining" : "download-flyout-estimating"
            }
            typographyType="body-sm"
          >
            {eta.status === "ready"
              ? t("{{time}} remaining", { replace: { time: formatRemaining(eta.seconds) } })
              : t("Calculating time remaining...")}
          </Typography>
        )}
      </div>
    </div>
  );
};
