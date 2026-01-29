import CollectionThumbnail from "../CollectionTile";

import React = require("react");
import { Button, Media, Modal } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { FlexLayout, MainContext, tooltip, types, util } from "vortex-api";

import { IRevision } from "@nexusmods/nexus-api";
import { useSelector } from "react-redux";

export interface IInstallChangelogDialogProps {
  gameId: string;
  collection: types.IMod;
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
  const lang: string = useSelector<types.IState, string>(
    (state) => state.settings.interface.language,
  );

  const context = React.useContext(MainContext);

  const openUrl = React.useCallback(() => {
    context.api.events.emit(
      "analytics-track-click-event",
      "Collections",
      "View on site Updated Collection",
    );
    util.opn(
      util.nexusModsURL(
        [
          revisionInfo.collection.game.domainName,
          "collections",
          revisionInfo.collection.slug,
        ],
        {
          campaign: util.Campaign.GeneralNavigation,
          section: util.Section.Collections,
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
    <Modal
      id="install-changelog-dialog"
      show={collection !== undefined}
      onHide={nop}
    >
      <Modal.Header>
        <Modal.Title>
          {t("{{collectionName}} update", {
            replace: { collectionName: util.renderModName(collection) },
          })}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Media.Left>
          <CollectionThumbnail
            t={t}
            gameId={gameId}
            collection={collection}
            details="some"
            imageTime={42}
            forceRevisionDisplay={revisionInfo.revisionNumber}
          />
        </Media.Left>
        <Media.Right>
          <FlexLayout type="row">
            <h4>
              {t("Revision {{revNum}} Changelog", {
                replace: { revNum: revisionInfo.revisionNumber },
              })}
            </h4>
            <div className="changelog-time">
              {changelogDate.toLocaleDateString(lang)}
            </div>
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

const localState = util.makeReactive<{ job: IInstallChangelogDialogProps }>({
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

export class InstallChangelogDialog extends React.Component<{}> {
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
        onContinue={job?.onContinue}
        onCancel={job?.onCancel}
      />
    );
  }
}

function showChangelog(
  collection: types.IMod,
  gameId: string,
  revisionInfo: IRevision,
): Promise<void> {
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
        reject(new util.UserCanceled());
      },
    };
  });
}

export default showChangelog;
