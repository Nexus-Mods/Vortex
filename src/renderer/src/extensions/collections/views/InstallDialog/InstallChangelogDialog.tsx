import type { IRevision } from "@nexusmods/nexus-api";
import React from "react";
import { useContext, useCallback, Component } from "react";
import { Button, Media, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { useSelector } from "react-redux";

import { MainContext } from "../../../../contexts";
import FlexLayout from "../../../../controls/FlexLayout";
import * as tooltip from "../../../../controls/TooltipControls";
import type { IMod } from "../../../../extensions/mod_management/types/IMod";
import renderModName from "../../../../extensions/mod_management/util/modName";
import type { IState } from "../../../../types/IState";
import { UserCanceled } from "../../../../util/CustomErrors";
import makeReactive from "../../../../util/makeReactive";
import opn from "../../../../util/opn";
import { Campaign, Section, nexusModsURL } from "../../../../util/util";
import CollectionThumbnail from "../CollectionTile";

export interface IInstallChangelogDialogProps {
  gameId: string;
  collection: IMod;
  revisionInfo: IRevision;
  onContinue: () => void;
  onCancel: () => void;
}

function nop() {
  // nop
}

function InstallChangelogDialogImpl(props: IInstallChangelogDialogProps) {
  const { collection, gameId, onCancel, onContinue, revisionInfo } = props;

  const { t } = useTranslation();
  const lang: string = useSelector<IState, string>((state) => state.settings.interface.language);

  const context = useContext(MainContext);

  const openUrl = useCallback(() => {
    context.api.events.emit(
      "analytics-track-click-event",
      "Collections",
      "View on site Updated Collection",
    );
    opn(
      nexusModsURL(
        [revisionInfo.collection.game.domainName, "collections", revisionInfo.collection.slug],
        {
          campaign: Campaign.GeneralNavigation,
          section: Section.Collections,
        },
      ),
    );
  }, [collection]);

  if (collection === undefined) {
    return null;
  }

  const changelog = revisionInfo.collectionChangelog;
  const changelogDate = new Date(changelog.createdAt);

  return (
    <Modal id="install-changelog-dialog" show={collection !== undefined} onHide={nop}>
      <Modal.Header>
        <Modal.Title>
          {t("{{collectionName}} update", {
            replace: { collectionName: renderModName(collection) },
          })}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Media.Left>
          <CollectionThumbnail
            collection={collection}
            details="some"
            forceRevisionDisplay={revisionInfo.revisionNumber}
            gameId={gameId}
            imageTime={42}
            t={t}
          />
        </Media.Left>

        <Media.Right>
          <FlexLayout type="row">
            <h4>
              {t("Revision {{revNum}} Changelog", {
                replace: { revNum: revisionInfo.revisionNumber },
              })}
            </h4>

            <div className="changelog-time">{changelogDate.toLocaleDateString(lang)}</div>
          </FlexLayout>

          <div className="changelog-scroll">
            <ReactMarkdown>{changelog.description}</ReactMarkdown>
          </div>
        </Media.Right>

        <tooltip.IconButton
          className="collection-open-button"
          icon="open-in-browser"
          tooltip={t("Open Page")}
          onClick={openUrl}
        >
          {t("View Collection")}
        </tooltip.IconButton>
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={onCancel}>{t("Later")}</Button>

        <Button onClick={onContinue}>{t("Download Update")}</Button>
      </Modal.Footer>
    </Modal>
  );
}

const localState = makeReactive<{ job: IInstallChangelogDialogProps }>({
  job: {
    collection: undefined,
    gameId: undefined,
    onCancel: () => {
      // nop
    },
    onContinue: () => {
      // nop
    },
    revisionInfo: undefined,
  },
});

export class InstallChangelogDialog extends Component<{}> {
  public componentDidMount(): void {
    localState["attach"]?.(this);
  }

  public componentWillUnmount(): void {
    localState["detach"]?.(this);
  }

  public render() {
    const { job } = localState;

    return (
      <InstallChangelogDialogImpl
        collection={job?.collection}
        gameId={job?.gameId}
        revisionInfo={job?.revisionInfo}
        onCancel={job?.onCancel}
        onContinue={job?.onContinue}
      />
    );
  }
}

function showChangelog(collection: IMod, gameId: string, revisionInfo: IRevision): Promise<void> {
  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    localState.job = {
      collection,
      gameId,
      revisionInfo,
      onContinue: () => {
        localState.job = undefined;
        resolve();
      },
      onCancel: () => {
        localState.job = undefined;
        reject(new UserCanceled());
      },
    };
  });
}

export default showChangelog;
