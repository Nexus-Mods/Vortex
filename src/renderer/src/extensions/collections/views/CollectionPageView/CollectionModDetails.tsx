import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";
import { GameDomain } from "@vortex/shared";
import React, { useCallback } from "react";
import { Panel } from "react-bootstrap";

import bbcodeToReact from "../../../../controls/bbcode";
import FlexLayout from "../../../../controls/FlexLayout";
import Image from "../../../../controls/Image";
import * as tooltip from "../../../../controls/TooltipControls";
import ZoomableImage from "../../../../controls/ZoomableImage";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import renderModName from "../../../../extensions/mod_management/util/modName";
import { nexusGameId } from "../../../../extensions/nexus_integration/util/convertGameId";
import { nexusModPageUrl } from "../../../../extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { TFunction } from "../../../../util/i18n";
import { AUTHOR_UNKNOWN, NEXUS_BASE_URL } from "../../constants";
import type { IModEx } from "../../types/IModEx";

export interface ICollectionModDetails {
  t: TFunction;
  local?: IModEx;
  remote?: ICollectionRevisionMod;
  gameId: string;
}

function CollectionModDetails(props: ICollectionModDetails) {
  const { t, gameId, local, remote } = props;

  const uploaderName = local?.attributes?.uploader ?? remote?.file?.owner?.name ?? AUTHOR_UNKNOWN;
  const uploaderId = local?.attributes?.uploaderId ?? remote?.file?.owner?.memberId;
  const uploaderAvatar = remote?.file?.owner?.avatar ?? "assets/images/noavatar.png";
  const authorName = local?.attributes?.author ?? remote?.file?.mod?.author ?? AUTHOR_UNKNOWN;
  const modTitle = renderModName(local) ?? remote?.file?.mod?.name ?? "";
  const version = local?.attributes?.version ?? remote?.file?.version ?? "???";
  const description = local?.attributes?.shortDescription ?? remote?.file?.mod?.summary ?? "";
  const image = local?.attributes?.pictureUrl ?? remote?.file?.mod?.pictureUrl;

  const remoteDomain = remote?.file?.game?.domainName;
  const vortexGameId = local?.attributes?.gameId ?? gameId;
  const domainName = remoteDomain
    ? GameDomain(remoteDomain)
    : nexusGameId(getGame(vortexGameId), vortexGameId);
  const modId = local?.attributes?.modId ?? remote?.file?.modId;

  const visitUploader = useCallback(() => {
    window.api.shell.openUrl(`${NEXUS_BASE_URL}/users/${uploaderId}`);
  }, [uploaderId]);

  const visitPage = useCallback(() => {
    window.api.shell.openUrl(nexusModPageUrl(domainName, modId));
  }, [domainName, modId]);

  return (
    <div className="installing-mod-overview">
      <FlexLayout type="row">
        <FlexLayout.Fixed className="collection-mod-detail-imagecontainer">
          {image ? <ZoomableImage className="installing-mod-image" url={image} /> : null}
        </FlexLayout.Fixed>

        <FlexLayout.Flex fill>
          <FlexLayout type="column">
            <FlexLayout.Fixed>
              <FlexLayout type="row">
                <div className="installing-mod-title">{modTitle}</div>

                {modId !== undefined ? (
                  <tooltip.IconButton
                    className="collection-open-mod-in-browser"
                    icon="open-in-browser"
                    tooltip={t("Open Mod in Webbrowser")}
                    onClick={visitPage}
                  />
                ) : null}
              </FlexLayout>
            </FlexLayout.Fixed>

            <FlexLayout.Flex>
              <div className="collection-description">{bbcodeToReact(description)}</div>
            </FlexLayout.Flex>

            <FlexLayout.Fixed>
              <FlexLayout type="row">
                <FlexLayout.Fixed className="collection-detail-cell">
                  <FlexLayout type="row">
                    <Image circle srcs={[uploaderAvatar]} />

                    <div>
                      <div className="title">{t("Uploaded by")}</div>

                      <div>
                        {uploaderName !== AUTHOR_UNKNOWN ? (
                          <a onClick={visitUploader}>{uploaderName}</a>
                        ) : (
                          uploaderName
                        )}
                      </div>
                    </div>
                  </FlexLayout>
                </FlexLayout.Fixed>

                <FlexLayout.Fixed className="collection-detail-cell">
                  <div className="title">{t("Created by")}</div>

                  <div>{authorName}</div>
                </FlexLayout.Fixed>

                <FlexLayout.Fixed className="collection-detail-cell">
                  <div className="title">{t("Version")}</div>

                  <div>{version}</div>
                </FlexLayout.Fixed>
              </FlexLayout>
            </FlexLayout.Fixed>
          </FlexLayout>
        </FlexLayout.Flex>
      </FlexLayout>
    </div>
  );
}

export default CollectionModDetails;
