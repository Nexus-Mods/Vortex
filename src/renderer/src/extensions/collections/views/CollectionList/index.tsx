import type { IRating, IRevision } from "@nexusmods/nexus-api";
import { getErrorCode, unknownToError } from "@vortex/shared";
import Bluebird from "bluebird";
import type { TFunction } from "i18next";
import * as React from "react";
import type { WithTranslation } from "react-i18next";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import * as actions from "../../../../actions";
import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import * as tooltip from "../../../../controls/TooltipControls";
import type { IDownload } from "../../../../extensions/download_management/types/IDownload";
import type { IGameStored } from "../../../../extensions/gamemode_management/types/IGameStored";
import type { IMod, IModRule } from "../../../../extensions/mod_management/types/IMod";
import { findModByRef } from "../../../../extensions/mod_management/util/findModByRef";
import renderModName from "../../../../extensions/mod_management/util/modName";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import { log } from "../../../../logging";
import type { INotification } from "../../../../types/INotification";
import type { IState } from "../../../../types/IState";
import { ProcessCanceled, UserCanceled } from "../../../../util/CustomErrors";
import Debouncer from "../../../../util/Debouncer";
import * as selectors from "../../../../util/selectors";
import { getSafe } from "../../../../util/storeHelper";
import { toPromise } from "../../../../util/util";
import MainPage from "../../../../views/MainPage";
import { updateSuccessRate } from "../../actions/persistent";
import { doExportToAPI } from "../../collectionExport";
import { MOD_TYPE, NAMESPACE } from "../../constants";
import type { IExtensionFeature } from "../../util/extension";
import { findExtensions } from "../../util/extension";
import type InstallDriver from "../../util/InstallDriver";
import { uploadCollection } from "../../util/uploadCollection";
import { hasEditPermissions } from "../../util/util";
import CollectionEdit from "../CollectionPageEdit";
import type { IPathTools } from "../CollectionPageEdit/FileOverrides";
import CollectionPage from "../CollectionPageView";
import StartPage from "./StartPage";

export interface ICollectionsMainPageBaseProps extends WithTranslation {
  active: boolean;
  secondary: boolean;
  pathTool: IPathTools;
  localState: { ownCollections: IRevision[] };
  driver: InstallDriver;
  onAddCallback: (cbName: string, cb: (...args: any[]) => void) => void;
  onCloneCollection: (collectionId: string) => Promise<string>;
  onRemoveCollection: (gameId: string, modId: string, cancel: boolean) => Promise<void>;
  onCreateCollection: (profile: IProfile, name: string) => void;
  onInstallCollection: (revision: IRevision) => Promise<void>;
  onUpdateMeta: () => void;

  resetCB: (cb: () => void) => void;
}

interface IConnectedProps {
  profile: IProfile;
  game: IGameStored;
  mods: { [modId: string]: IMod };
  downloads: { [dlId: string]: IDownload };
  notifications: INotification[];
  exts: IExtensionFeature[];
  userInfo: { name: string; userId: number };
}

interface IActionProps {
  removeMod: (gameId: string, modId: string) => void;
}

export type ICollectionsMainPageProps = ICollectionsMainPageBaseProps &
  IConnectedProps &
  IActionProps & { t: TFunction };

interface IComponentState {
  selectedCollection: string;
  matchedReferences: { [collectionId: string]: IMod[] };
  viewMode: "view" | "edit";
  activeTab: string;
}

const emptyObj = {};
const emptyArr = [];

class CollectionsMainPage extends ComponentEx<ICollectionsMainPageProps, IComponentState> {
  private mMatchRefDebouncer: Debouncer;
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

      props.onAddCallback("editCollection", (collectionId: string) => {
        this.showPage("edit", collectionId);
      });
    }

    props.resetCB?.(this.resetMainPage);

    this.mMatchRefDebouncer = new Debouncer(() => {
      this.nextState.matchedReferences = this.updateMatchedReferences(this.props);
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
    const { t, downloads, driver, game, localState, mods, notifications, profile, pathTool } =
      this.props;

    const { activeTab, matchedReferences, selectedCollection, viewMode } = this.state;

    if (profile === undefined) {
      return null;
    }

    const collection = selectedCollection !== undefined ? mods[selectedCollection] : undefined;

    let content: JSX.Element;

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
            activeTab={activeTab}
            game={game}
            infoCache={driver.infoCache}
            installing={driver.installDone ? undefined : driver.collection}
            localState={localState}
            matchedReferences={matchedReferences ?? emptyObj}
            mods={mods}
            profile={profile}
            t={t}
            onClone={this.clone}
            onCreateCollection={this.createCollection}
            onEdit={this.edit}
            onInstallCollection={this.props.onInstallCollection}
            onPause={this.pause}
            onRemove={this.remove}
            onResume={this.resume}
            onSetActiveTab={this.setActiveTab}
            onUpdate={this.update}
            onUpload={this.upload}
            onView={this.view}
          />
        </>
      );
    } else {
      content = (
        <FlexLayout type="column">
          <FlexLayout.Fixed>
            <tooltip.IconButton
              className="collection-back-btn"
              icon="nav-back"
              tooltip="Return to overview"
              onClick={this.deselectCollection}
            >
              {t("View All Collections")}
            </tooltip.IconButton>
          </FlexLayout.Fixed>

          <FlexLayout.Flex>
            {viewMode === "view" ? (
              <CollectionPage
                className="collection-details"
                collection={collection}
                downloads={downloads}
                driver={this.props.driver}
                mods={mods}
                notifications={notifications}
                profile={profile}
                t={t}
                onAddCallback={this.props.onAddCallback}
                onCancel={this.cancel}
                onClone={this.clone}
                onInstallManually={this.installManually}
                onPause={this.pause}
                onResume={this.resume}
                onView={this.view}
                onVoteSuccess={this.voteSuccess}
              />
            ) : (
              <CollectionEdit
                collection={collection}
                driver={this.props.driver}
                exts={this.props.exts}
                mods={mods}
                pathTool={pathTool}
                profile={profile}
                onRemove={this.remove}
                onUpload={this.upload}
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
    this.context.api.events.emit("analytics-track-click-event", "Collections", "Refresh");
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
    const canContribute = hasEditPermissions(mods[modId].attributes?.permissions);

    if (author !== undefined && author !== userInfo?.userId && !canContribute) {
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

  private pause = (modId: string) => {
    const { mods, profile } = this.props;

    if (mods[modId] === undefined) {
      return;
    }

    // Route through the canonical pause-collection handler so the pause is logged once
    // at its chokepoint and shares one cleanup path (driver reset, in-progress-only
    // download pause) instead of a divergent copy here.
    this.context.api.events.emit("pause-collection", profile.gameId, modId, "user");

    this.context.api.sendNotification({
      id: "collection-pausing",
      type: "success",
      title: "Collection pausing",
      message: "Already queued mod installations will still finish",
      displayMS: 3000,
    });
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
          collectionName: renderModName(mods[modId]),
        },
      },
      [{ label: "Cancel" }, { label: "Remove" }],
    );

    if (result.action === "Remove") {
      await toPromise((cb) =>
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
        updateSuccessRate(revisionId, vote, voted.averageRating.average, voted.averageRating.total),
      );
    }
  };

  private updateMatchedReferences(props: ICollectionsMainPageProps) {
    const { mods, profile } = props;
    const collections = Object.values(mods).filter((mod) => mod.type === MOD_TYPE);
    return collections.reduce((prev, collection) => {
      prev[collection.id] = (collection.rules || [])
        .filter((rule) => rule.type === "requires" && !rule["ignored"])
        .map((rule) => {
          const mod = findModByRef(rule.reference, mods);
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
        api.events.emit("analytics-track-click-event", "Collections", "Remove Workshop Collection");
        return this.removeWorkshop(modId).catch((err: unknown) => {
          const allowReport =
            !["EPERM"].includes(getErrorCode(err)) &&
            !(err instanceof ProcessCanceled) &&
            !(err instanceof UserCanceled);
          api.showErrorNotification("Failed to remove collection", unknownToError(err), {
            allowReport,
          });
        });
      } else {
        api.events.emit("analytics-track-click-event", "Collections", "Remove Added Collection");
        return this.cancel(modId, false).catch((err: unknown) => {
          api.showErrorNotification("Failed to remove collection", unknownToError(err), {
            allowReport: !["EPERM"].includes(getErrorCode(err)),
          });
        });
      }
    } catch (err) {
      if (err instanceof UserCanceled) {
        log("info", "collection removal canceled by user");
      } else if (err instanceof ProcessCanceled) {
        api.sendNotification({
          type: "warning",
          title: "Removal failed",
          message: err.message,
        });
      } else {
        api.showErrorNotification("Failed to remove collection", unknownToError(err));
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

    const downloadGame = getSafe(mod.attributes, ["downloadGame"], gameMode);
    const newestFileId = getSafe(mod.attributes, ["newestVersion"], undefined);
    await toPromise((cb) =>
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

  private installManually = (collectionId: string, rules: IModRule[]) => {
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
        return api.emitAndAwait("install-from-dependencies", collectionId, ruleList, recommended);
      }
    };

    eaa(ruleGroups.requires, false)
      .then(() => eaa(ruleGroups.recommends, true))
      .catch((err: unknown) => {
        if (err instanceof UserCanceled) {
          return;
        }
        api.showErrorNotification("Failed to install dependencies", unknownToError(err), {
          allowReport: !(err instanceof ProcessCanceled),
        });
      });
  };

  private resume = (modId: string) => {
    const { profile } = this.props;
    if (profile === undefined) {
      return;
    }

    // Route through the canonical resume-collection handler, which owns the not-logged-in
    // guard, logging, and the start path.
    this.context.api.events.emit("resume-collection", profile.gameId, modId);
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  const game = profile !== undefined ? selectors.gameById(state, profile.gameId) : undefined;
  return {
    game,
    profile,
    mods: profile !== undefined ? (state.persistent.mods[profile.gameId] ?? emptyObj) : emptyObj,
    notifications: state.session.notifications.notifications,
    downloads: state.persistent.downloads.files,
    userInfo: state.persistent["nexus"]?.userInfo,
    exts: profile !== undefined ? findExtensions(state, profile.gameId) : emptyArr,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    removeMod: (gameId: string, modId: string) => dispatch(actions.removeMod(gameId, modId)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withTranslation([NAMESPACE, "common"])(CollectionsMainPage));
