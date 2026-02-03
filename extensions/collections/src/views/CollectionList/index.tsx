/* eslint-disable */
import Bluebird from "bluebird";
import { updateSuccessRate } from "../../actions/persistent";
import { doExportToAPI } from "../../collectionExport";
import {
  INSTALLING_NOTIFICATION_ID,
  MOD_TYPE,
  NAMESPACE,
  TOS_URL,
} from "../../constants";
import { findExtensions, IExtensionFeature } from "../../util/extension";
import InstallDriver from "../../util/InstallDriver";

import { IPathTools } from "../CollectionPageEdit/FileOverrides";
import CollectionEdit from "../CollectionPageEdit";
import CollectionPage from "../CollectionPageView";
import StartPage from "./StartPage";

import { IRating, IRevision } from "@nexusmods/nexus-api";
import I18next from "i18next";
import * as React from "react";
import { WithTranslation, withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import {
  actions,
  ComponentEx,
  FlexLayout,
  log,
  MainPage,
  selectors,
  tooltip,
  types,
  util,
} from "vortex-api";
import { uploadCollection } from "../../util/util";

export interface ICollectionsMainPageBaseProps extends WithTranslation {
  active: boolean;
  secondary: boolean;
  pathTool: IPathTools;
  localState: { ownCollections: IRevision[] };
  driver: InstallDriver;
  onAddCallback: (cbName: string, cb: (...args: any[]) => void) => void;
  onCloneCollection: (collectionId: string) => Promise<string>;
  onRemoveCollection: (
    gameId: string,
    modId: string,
    cancel: boolean,
  ) => Promise<void>;
  onCreateCollection: (profile: types.IProfile, name: string) => void;
  onInstallCollection: (revision: IRevision) => Promise<void>;
  onUpdateMeta: () => void;

  resetCB: (cb: () => void) => void;
}

interface IConnectedProps {
  profile: types.IProfile;
  game: types.IGameStored;
  mods: { [modId: string]: types.IMod };
  downloads: { [dlId: string]: types.IDownload };
  notifications: types.INotification[];
  exts: IExtensionFeature[];
  userInfo: { name: string; userId: number };
}

interface IActionProps {
  removeMod: (gameId: string, modId: string) => void;
}

export type ICollectionsMainPageProps = ICollectionsMainPageBaseProps &
  IConnectedProps &
  IActionProps & { t: I18next.TFunction };

interface IComponentState {
  selectedCollection: string;
  matchedReferences: { [collectionId: string]: types.IMod[] };
  viewMode: "view" | "edit";
  activeTab: string;
}

const emptyObj = {};
const emptyArr = [];

class CollectionsMainPage extends ComponentEx<
  ICollectionsMainPageProps,
  IComponentState
> {
  private mMatchRefDebouncer: util.Debouncer;
  constructor(props: ICollectionsMainPageProps) {
    super(props);
    this.initState({
      selectedCollection: undefined,
      matchedReferences: this.updateMatchedReferences(this.props),
      viewMode: "view",
      activeTab: "active-collections",
    });

    if (props.onAddCallback !== undefined) {
      props.onAddCallback("viewCollection", (collectionId: string) => {
        this.showPage("view", collectionId);
      });

      props.onAddCallback("editCollection", () => (collectionId: string) => {
        this.showPage("edit", collectionId);
      });
    }

    props.resetCB?.(this.resetMainPage);

    this.mMatchRefDebouncer = new util.Debouncer(() => {
      this.nextState.matchedReferences = this.updateMatchedReferences(
        this.props,
      );
      return Promise.resolve();
    }, 2000);
  }

  public UNSAFE_componentWillReceiveProps(newProps: ICollectionsMainPageProps) {
    if (this.props.mods !== newProps.mods) {
      this.mMatchRefDebouncer.schedule();
    }
  }

  public componentWillUnmount() {
    this.mMatchRefDebouncer.clear();
  }

  public render(): JSX.Element {
    const {
      t,
      downloads,
      driver,
      game,
      localState,
      mods,
      notifications,
      profile,
      pathTool,
    } = this.props;

    const { activeTab, matchedReferences, selectedCollection, viewMode } =
      this.state;

    if (profile === undefined) {
      return null;
    }

    const collection =
      selectedCollection !== undefined ? mods[selectedCollection] : undefined;

    let content = null;

    if (collection === undefined) {
      content = (
        <>
          <tooltip.IconButton
            className="collections-refresh-meta"
            icon="refresh"
            tooltip={t(
              "Download the latest meta information about your installed and owned collections. " +
                "This will reset local changes to names of collections in your workshop.",
            )}
            onClick={this.onUpdateMeta}
          >
            {t("Refresh")}
          </tooltip.IconButton>
          <StartPage
            t={t}
            game={game}
            localState={localState}
            installing={driver.installDone ? undefined : driver.collection}
            infoCache={driver.infoCache}
            profile={profile}
            mods={mods}
            matchedReferences={matchedReferences ?? emptyObj}
            activeTab={activeTab}
            onView={this.view}
            onEdit={this.edit}
            onRemove={this.remove}
            onUpdate={this.update}
            onUpload={this.upload}
            onClone={this.clone}
            onCreateCollection={this.createCollection}
            onResume={this.resume}
            onPause={this.pause}
            onSetActiveTab={this.setActiveTab}
            onInstallCollection={this.props.onInstallCollection}
          />
        </>
      );
    } else {
      content = (
        <FlexLayout type="column">
          <FlexLayout.Fixed>
            <tooltip.IconButton
              className="collection-back-btn"
              tooltip="Return to overview"
              icon="nav-back"
              onClick={this.deselectCollection}
            >
              {t("View All Collections")}
            </tooltip.IconButton>
          </FlexLayout.Fixed>
          <FlexLayout.Flex>
            {viewMode === "view" ? (
              <CollectionPage
                t={t}
                className="collection-details"
                driver={this.props.driver}
                profile={profile}
                collection={collection}
                mods={mods}
                downloads={downloads}
                notifications={notifications}
                onAddCallback={this.props.onAddCallback}
                onView={this.view}
                onPause={this.pause}
                onCancel={this.cancel}
                onClone={this.clone}
                onResume={this.resume}
                onInstallManually={this.installManually}
                onVoteSuccess={this.voteSuccess}
              />
            ) : (
              <CollectionEdit
                profile={profile}
                collection={collection}
                mods={mods}
                driver={this.props.driver}
                onRemove={this.remove}
                onUpload={this.upload}
                exts={this.props.exts}
                pathTool={pathTool}
              />
            )}
          </FlexLayout.Flex>
        </FlexLayout>
      );
    }

    return (
      <MainPage id="collection-page">
        <MainPage.Body>{content}</MainPage.Body>
      </MainPage>
    );
  }

  private showPage(page: "view" | "edit", modId: string) {
    this.nextState.selectedCollection = modId;
    this.nextState.viewMode = page;
  }

  private onUpdateMeta = () => {
    this.props.onUpdateMeta();
    this.context.api.events.emit(
      "analytics-track-click-event",
      "Collections",
      "Refresh",
    );
  };

  private setActiveTab = (tabId: string) => {
    this.nextState.activeTab = tabId;
  };

  private createCollection = (name: string) => {
    const { profile, onCreateCollection } = this.props;
    onCreateCollection(profile, name);
  };

  private deselectCollection = () => {
    this.nextState.selectedCollection = undefined;
  };

  private resetMainPage = () => {
    this.deselectCollection();
  };

  private view = (modId: string) => {
    this.showPage("view", modId);
  };

  private edit = async (modId: string) => {
    const { mods, userInfo } = this.props;
    const { api } = this.context;

    if (mods[modId] === undefined) {
      return;
    }

    const author = mods[modId].attributes?.["uploaderId"];

    if (author !== undefined && author !== userInfo?.userId) {
      const result = await api.showDialog(
        "question",
        "Edit Collection",
        {
          text:
            "This collection has been uploaded with a different account ({{uploadAuthor}}) " +
            "than you're using now ({{currentUser}}). " +
            "If you edit and upload this collection now it will be uploaded as a new " +
            "collection by your current user.",
          parameters: {
            uploadAuthor: mods[modId].attributes["uploader"],
            currentUser: userInfo?.name ?? "<Logged out>",
          },
        },
        [{ label: "Cancel" }, { label: "Continue" }],
      );
      if (result.action === "Cancel") {
        return;
      }
    }
    this.showPage("edit", modId);
  };

  private pause = async (modId: string, silent?: boolean) => {
    const { downloads, mods } = this.props;

    const collection = mods[modId];
    if (collection === undefined) {
      return;
    }

    (collection?.rules ?? []).forEach((rule) => {
      const dlId = util.findDownloadByRef(rule.reference, downloads);
      if (dlId !== undefined) {
        this.context.api.events.emit("pause-download", dlId);
      }
    });
    const { api } = this.context;
    await api.emitAndAwait("cancel-dependency-install", modId);

    this.props.driver.cancel();

    api.dismissNotification(INSTALLING_NOTIFICATION_ID + modId);
    if (silent !== true) {
      api.sendNotification({
        id: "collection-pausing",
        type: "success",
        title: "Collection pausing",
        message: "Already queued mod installations will still finish",
        displayMS: 3000,
      });
    }
  };

  private async removeWorkshop(modId: string) {
    const { mods, profile } = this.props;
    const { api } = this.context;

    const result = await api.showDialog(
      "question",
      "Remove Collection (Workshop)",
      {
        text:
          "Deleting a collection will not remove the mods that have been added to it.\n\n" +
          "Any changes made to this collection since the last upload to Nexus Mods will " +
          "be lost.\n\n" +
          'Are you sure you want to remove "{{collectionName}}" from your Workshop?',
        parameters: {
          collectionName: util.renderModName(mods[modId]),
        },
      },
      [{ label: "Cancel" }, { label: "Remove" }],
    );

    if (result.action === "Remove") {
      await util.toPromise((cb) =>
        api.events.emit("remove-mod", profile.gameId, modId, cb, {
          incomplete: true,
        }),
      );
    }
  }

  private clone = async (collectionId: string) => {
    const id: string = await this.props.onCloneCollection(collectionId);
    if (id !== undefined) {
      this.showPage("edit", id);
    }
  };

  private cancel = async (modId: string, cancel?: boolean) => {
    const { profile } = this.props;

    return this.props.onRemoveCollection(profile.gameId, modId, cancel ?? true);
  };

  private voteSuccess = async (modId: string, success: boolean) => {
    const { mods } = this.props;
    const { api } = this.context;

    const collection = mods[modId];

    if (collection === undefined) {
      return;
    }

    const { revisionId } = collection.attributes;

    if (revisionId === undefined) {
      return;
    }

    const vote = success ? "positive" : "negative";
    const voted: { success: boolean; averageRating?: IRating } = (
      await api.emitAndAwait("rate-nexus-collection-revision", revisionId, vote)
    )[0];
    if (voted.success) {
      api.store.dispatch(
        updateSuccessRate(
          revisionId,
          vote,
          voted.averageRating.average,
          voted.averageRating.total,
        ),
      );
    }
  };

  private updateMatchedReferences(props: ICollectionsMainPageProps) {
    const { mods, profile } = props;
    const collections = Object.values(mods).filter(
      (mod) => mod.type === MOD_TYPE,
    );
    return collections.reduce((prev, collection) => {
      prev[collection.id] = (collection.rules || [])
        .filter((rule) => rule.type === "requires" && !rule["ignored"])
        .map((rule) => {
          const mod = util.findModByRef(rule.reference, mods);
          if (mod !== undefined && !profile.modState?.[mod.id]?.enabled) {
            return null;
          }
          return mod ?? null;
        });
      return prev;
    }, {});
  }

  private remove = (modId: string) => {
    const { mods } = this.props;
    const { api } = this.context;

    if (mods[modId] === undefined) {
      return;
    }

    try {
      if (mods[modId]?.attributes?.editable) {
        api.events.emit(
          "analytics-track-click-event",
          "Collections",
          "Remove Workshop Collection",
        );
        return this.removeWorkshop(modId).catch((err) => {
          const allowReport =
            !["EPERM"].includes(err.code) &&
            !(err instanceof util.ProcessCanceled) &&
            !(err instanceof util.UserCanceled);
          api.showErrorNotification("Failed to remove collection", err, {
            allowReport,
          });
        });
      } else {
        api.events.emit(
          "analytics-track-click-event",
          "Collections",
          "Remove Added Collection",
        );
        return this.cancel(modId, false).catch((err) => {
          api.showErrorNotification("Failed to remove collection", err, {
            allowReport: !["EPERM"].includes(err.code),
          });
        });
      }
    } catch (err) {
      if (err instanceof util.UserCanceled) {
        log("info", "collection removal canceled by user");
      } else if (err instanceof util.ProcessCanceled) {
        api.sendNotification({
          type: "warning",
          title: "Removal failed",
          message: err.message,
        });
      } else {
        api.showErrorNotification("Failed to remove collection", err);
      }
    }
  };

  private update = async (collectionId: string) => {
    const { mods } = this.props;
    const { api } = this.context;
    const state = api.getState();
    const gameMode = selectors.activeGameId(state);
    const mod = mods[collectionId];

    if (mod === undefined) {
      return;
    }

    const downloadGame = util.getSafe(
      mod.attributes,
      ["downloadGame"],
      gameMode,
    );
    const newestFileId = util.getSafe(
      mod.attributes,
      ["newestVersion"],
      undefined,
    );
    await util.toPromise((cb) =>
      this.context.api.events.emit(
        "collection-update",
        downloadGame,
        mod.attributes?.collectionSlug,
        newestFileId,
        mod.attributes?.source,
        collectionId,
        cb,
      ),
    );
  };

  private upload = async (collectionId: string) => {
    uploadCollection(this.context.api, this.props.profile?.id, collectionId);
  };

  private installManually = (collectionId: string, rules: types.IModRule[]) => {
    const { api } = this.context;

    const ruleGroups = rules.reduce(
      (prev, rule) => {
        if (prev[rule.type] !== undefined) {
          prev[rule.type].push(rule);
        } else {
          log("error", "unexpected rule encountered", {
            collectionId,
            ruleType: rule.type,
          });
        }
        return prev;
      },
      { requires: [], recommends: [] },
    );

    const eaa = (ruleList, recommended) => {
      if (ruleList.length === 0) {
        return Bluebird.resolve();
      } else {
        return api.emitAndAwait(
          "install-from-dependencies",
          collectionId,
          ruleList,
          recommended,
        );
      }
    };

    eaa(ruleGroups.requires, false)
      .then(() => eaa(ruleGroups.recommends, true))
      .catch((err) => {
        if (err instanceof util.UserCanceled) {
          return;
        }
        api.showErrorNotification("Failed to install dependencies", err, {
          allowReport: !(err instanceof util.ProcessCanceled),
        });
      });
  };

  private resume = async (modId: string) => {
    const { driver, mods, profile, userInfo } = this.props;

    if (mods[modId] === undefined) {
      return;
    }

    if (userInfo === null || userInfo === undefined) {
      const { api } = this.context;
      api.showDialog(
        "info",
        "Not logged in",
        {
          text: "You have to be logged in with Nexus Mods to install collections.",
        },
        [{ label: "Continue" }],
      );
    } else if (mods[modId] !== undefined) {
      driver.start(profile, mods[modId]);
    }
  };
}

function mapStateToProps(state: types.IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  const game =
    profile !== undefined
      ? selectors.gameById(state, profile.gameId)
      : undefined;
  return {
    game,
    profile,
    mods:
      profile !== undefined
        ? (state.persistent.mods[profile.gameId] ?? emptyObj)
        : emptyObj,
    notifications: state.session.notifications.notifications,
    downloads: state.persistent.downloads.files,
    userInfo: state.persistent["nexus"]?.userInfo,
    exts:
      profile !== undefined ? findExtensions(state, profile.gameId) : emptyArr,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    removeMod: (gameId: string, modId: string) =>
      dispatch(actions.removeMod(gameId, modId)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTranslation([NAMESPACE, "common"])(CollectionsMainPage));
