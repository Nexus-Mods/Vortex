import type { IFileInfo } from "@nexusmods/nexus-api";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { NexusGameDomain, type VortexGameId, VortexModId } from "@vortex/shared";
import numeral from "numeral";
import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useBrowseModsTracker } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/BrowseModsTracking.context";
import { useBrowseWebsiteLink } from "@/extensions/browse_nexus/hooks/use_browse_website_link/useBrowseWebsiteLink.hook";
import { useModInstallState } from "@/extensions/browse_nexus/hooks/use_mod_install_state/useModInstallState.hook";
import { fileUidOf } from "@/extensions/browse_nexus/util/file_uid/fileUid";
import {
  installNexusFile,
  installsWhenDownloaded,
  reportInstallFailure,
} from "@/extensions/browse_nexus/util/install_nexus_file/installNexusFile";
import type { ModInstallState } from "@/extensions/browse_nexus/util/mod_install_state/modInstallState";
import { oneClickFileInstallKey } from "@/extensions/browse_nexus/util/one_click_install/oneClickInstall";
import { showModOnModsPage } from "@/extensions/mod_management/util/show_mod_on_mods_page/showModOnModsPage";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { nexusFilePageUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";
import { nxmModOutline } from "@/ui/icon-paths";
import { activeGameId } from "@/util/selectors";

import { FileDate } from "./file_date/FileDate";

/** When the user got a file: installed, by its mod's install time, or downloaded; none if unknown. */
const gotAt = (state: ModInstallState) => {
  if (state.kind === "downloaded" && state.downloadedAt) {
    return { kind: "downloaded" as const, timestamp: state.downloadedAt };
  }

  if (state.kind !== "installed" || !state.mod.attributes?.installTime) {
    return undefined;
  }

  const timestamp = new Date(state.mod.attributes.installTime).getTime();

  return Number.isNaN(timestamp) ? undefined : { kind: "installed" as const, timestamp };
};

interface IMainFileCardProps {
  api: IExtensionApi;
  /** The mod the file is of. */
  mod: ModSummary;
  /** The file to show, and install. */
  file: IFileInfo;
  /** Closes the picker, as each action starts something outside it, like an install's dialogs. */
  onLeave: () => void;
}

/**
 * One Main file of a mod: what it is, what the user has of it, and the one button for that, which
 * acts on this file only. Its progress is its own, so other cards stay usable.
 */
export const MainFileCard = ({ api, mod, file, onLeave }: IMainFileCardProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const websiteLink = useBrowseWebsiteLink();
  const gameId = useSelector(activeGameId);
  const shouldInstall = !!useSelector(installsWhenDownloaded);
  const nameId = useId();
  const domain = NexusGameDomain(mod.game.domain_name);
  const installKey = oneClickFileInstallKey({ modId: mod.id, fileId: file.file_id });
  const isInstalling = useIsMutating({ mutationKey: installKey }) > 0;
  const state = useModInstallState({
    domain,
    modId: Number(mod.game_scoped_id),
    fileId: file.file_id,
  });

  const got = gotAt(state);

  const install = useMutation({
    mutationKey: installKey,
    mutationFn: (gameId: VortexGameId) =>
      installNexusFile(api, {
        mod,
        fileId: String(file.file_id),
        gameId,
        shouldInstall,
      }),
    onMutate: () =>
      tracker.trackOneClickClicked({
        mod_uid: mod.id,
        file_uid: fileUidOf(mod, file.file_id),
        action: shouldInstall ? "install" : "download",
      }),
    onError: (error) => reportInstallFailure(api, { t, mod, shouldInstall, error }),
  });

  const oneClick = () => (
    <Button
      data-testid={`main-file-card-action-${file.file_id}`}
      disabled={isInstalling}
      isLoading={isInstalling}
      leftIcon="install_desktop"
      size="sm"
      onClick={() => {
        if (!gameId) {
          return;
        }

        install.mutate(gameId);
        onLeave();
      }}
    >
      {t("1-click install")}
    </Button>
  );

  const action = () => {
    if (isInstalling) {
      return oneClick();
    }

    if (state.kind === "installing") {
      return (
        <Button
          disabled
          isLoading
          data-testid={`main-file-card-action-${file.file_id}`}
          leftIcon="add"
          size="sm"
        >
          {t("Install")}
        </Button>
      );
    }

    if (state.kind === "installed") {
      const modId = VortexModId(state.mod.id);

      return (
        <Button
          brand="neutral"
          data-testid={`main-file-card-action-${file.file_id}`}
          leftIcon={{ path: nxmModOutline }}
          size="sm"
          onClick={() => {
            tracker.trackViewInstalledClicked({ mod_uid: mod.id });
            onLeave();
            showModOnModsPage(api, modId);
          }}
        >
          {t("Manage mod")}
        </Button>
      );
    }

    if (state.kind === "downloaded") {
      const { downloadId } = state;

      return (
        <Button
          data-testid={`main-file-card-action-${file.file_id}`}
          leftIcon="add"
          size="sm"
          onClick={() => {
            tracker.trackInstallClicked({ mod_uid: mod.id });
            api.events.emit("start-install-download", downloadId);
            onLeave();
          }}
        >
          {t("Install")}
        </Button>
      );
    }

    return oneClick();
  };

  return (
    <div
      className="flex flex-col rounded-lg bg-surface-mid"
      aria-labelledby={nameId}
      data-testid={`main-file-card-${file.file_id}`}
      role="group"
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <Typography appearance="moderate" id={nameId} typographyType="body-sm">
            {file.name}
          </Typography>

          <Typography appearance="subdued" typographyType="body-sm">
            {file.version}
          </Typography>
        </div>

        {!!file.description && (
          <Typography appearance="subdued" as="div" typographyType="body-sm">
            <div className="line-clamp-2">
              <BBCode bbcode={file.description} context={{ embedVideos: false }} size="sm" />
            </div>
          </Typography>
        )}

        <TypographyLink
          appearance="subdued"
          className="self-start"
          data-testid={`main-file-card-details-link-${file.file_id}`}
          iconSize="xs"
          rightIcon="open_in_new"
          typographyType="body-sm"
          onClick={() =>
            window.api.shell.openUrl(
              websiteLink(nexusFilePageUrl(domain, mod.game_scoped_id, file.file_id)),
            )
          }
        >
          {t("View more details")}
        </TypographyLink>
      </div>

      <div className="h-px bg-stroke-weak" />

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Tooltip
            content={t("File size: {{size}}", {
              size: numeral(file.size_kb * 1024).format("0.00b"),
            })}
          >
            <span className="flex items-center gap-1" data-testid="main-file-card-size">
              <Icon className="text-neutral-subdued" name="hard_drive" size="sm" />

              <Typography appearance="subdued" as="span" typographyType="body-sm">
                {numeral(file.size_kb * 1024).format("0.0b")}
              </Typography>
            </span>
          </Tooltip>

          <FileDate
            fileId={file.file_id}
            kind="uploaded"
            timestamp={file.uploaded_timestamp * 1000}
          />

          {!!got && <FileDate fileId={file.file_id} kind={got.kind} timestamp={got.timestamp} />}
        </div>

        {action()}
      </div>
    </div>
  );
};
