/* eslint-disable */
import {
  AUTHOR_UNKNOWN,
  AVATAR_FALLBACK,
  INSTALLING_NOTIFICATION_ID,
} from "../../constants";
import { testDownloadReference } from "../../util/findModByRef";
import InstallDriver from "../../util/InstallDriver";

import { IModEx } from "../../types/IModEx";
import { IStateEx } from "../../types/IStateEx";

import CollectionInstructions from "./CollectionInstructions";
import CollectionItemStatus from "./CollectionItemStatus";
import CollectionOverview from "./CollectionOverview";
import CollectionOverviewSelection from "./CollectionOverviewSelection";
import CollectionProgress from "./CollectionProgress";

import {
  ICollection,
  ICollectionRevisionMod,
  IModFile,
  IRevision,
  RatingOptions,
} from "@nexusmods/nexus-api";
import Bluebird from "bluebird";
import i18next from "i18next";
import * as _ from "lodash";
import memoizeOne from "memoize-one";
import * as React from "react";
import { Image, Panel, Tab, Tabs } from "react-bootstrap";
import ReactDOM = require("react-dom");
import { connect } from "react-redux";
import * as Redux from "redux";
import * as semver from "semver";
import {
  actions,
  ComponentEx,
  FlexLayout,
  ITableRowAction,
  log,
  OptionsFilter,
  selectors,
  Table,
  TableTextFilter,
  tooltip,
  types,
  util,
} from "vortex-api";

export interface ICollectionPageProps {
  t: i18next.TFunction;
  className: string;
  profile: types.IProfile;
  collection: types.IMod;
  driver: InstallDriver;
  mods: { [modId: string]: types.IMod };
  downloads: { [dlId: string]: types.IDownload };
  notifications: types.INotification[];
  onAddCallback: (cbName: string, cb: (...args: any[]) => void) => void;
  onView: (modId: string) => void;
  onPause: (collectionId: string) => void;
  onCancel: (collectionId: string) => void;
  onClone: (collectionId: string) => void;
  onResume: (collectionId: string) => void;
  onInstallManually: (collectionId: string, rules: types.IModRule[]) => void;
  onVoteSuccess: (collectionId: string, success: boolean) => void;
}

interface IConnectedProps {
  userInfo: any;
  votedSuccess: RatingOptions;
  activity: { [id: string]: string };
  language: string;
  overlays: { [id: string]: types.IOverlay };
  collectionInfo: ICollection;
  revisionInfo: IRevision;
  showUpvoteResponse: boolean;
  showDownvoteResponse: boolean;
}

interface IActionProps {
  onSetModEnabled: (profileId: string, modId: string, enable: boolean) => void;
  onSetAttributeFilter: (
    tableId: string,
    filterId: string,
    filterValue: any,
  ) => void;
  onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) => void;
  onShowError: (
    message: string,
    details?: string | Error | any,
    allowReport?: boolean,
  ) => void;
  onSuppressVoteResponse: (response: "upvote" | "downvote") => void;
}

interface IComponentState {
  modsEx: { [modId: string]: IModEx };
  modSelection: Array<{ local: IModEx; remote: ICollectionRevisionMod }>;
  currentTab: string;
}

const getCollator = (() => {
  let collator: Intl.Collator;
  let language: string;

  return (locale: string): Intl.Collator => {
    if (collator === undefined || locale !== language) {
      language = locale;
      collator = new Intl.Collator(locale, { sensitivity: "base" });
    }
    return collator;
  };
})();

const STATUS_ORDER: string[] = [
  "Installing",
  "Downloading",
  "Install Pending",
  "Download Pending",
  "Enabled",
  "Disabled",
  "Recommended",
  "Ignored",
];

type IProps = ICollectionPageProps & IConnectedProps & IActionProps;

function arr(input: string | string[]): string[] {
  return Array.isArray(input) ? input : [input];
}

function matchRepo(mod: IModEx, ref: IModFile) {
  if (ref === null) {
    return false;
  }

  const modId =
    mod.attributes?.modId || mod.collectionRule?.reference?.repo?.modId;
  const fileId =
    mod.attributes?.fileId || mod.collectionRule?.reference?.repo?.fileId;

  if (
    modId === undefined ||
    fileId === undefined ||
    ref.modId === undefined ||
    ref.fileId === undefined
  ) {
    return false;
  }

  return (
    modId.toString() === ref.modId.toString() &&
    fileId.toString() === ref.fileId.toString()
  );
}

class CollectionPage extends ComponentEx<IProps, IComponentState> {
  private mAttributes: Array<types.ITableAttribute<IModEx>>;
  private mUpdateDebouncer: util.Debouncer;
  private mModActions: ITableRowAction[];
  private mTableContainerRef: Element;
  private mLastModsFinal: { [ruleId: string]: IModEx };
  private mInstalling: boolean = false;

  private revisionMerged = memoizeOne(
    (collection: ICollection, revision: IRevision) =>
      ({
        ...revision,
        collection,
      }) as any as IRevision,
  );

  constructor(props: IProps) {
    super(props);
    this.initState({
      modsEx: {},
      modSelection: [],
      currentTab: "instructions",
    });

    this.mModActions = [
      {
        icon: "install",
        title: "Install",
        action: this.installManually,
        condition: (instanceIds) => {
          const isInstallingCollection = selectors.getCollectionActiveSession(
            this.context.api.getState(),
          );
          if (isInstallingCollection) {
            return false;
          }
          const instanceId: string = Array.isArray(instanceIds)
            ? instanceIds[0]
            : instanceIds;
          const mod = this.state.modsEx[instanceId];
          return [null, "downloaded"].includes(mod.state);
        },
      },
      {
        icon: "delete",
        title: "Remove",
        action: this.removeSelected,
        condition: (instanceId) => {
          const isInstallingCollection = selectors.getCollectionActiveSession(
            this.context.api.getState(),
          );
          if (isInstallingCollection) {
            return false;
          }
          return typeof instanceId === "string"
            ? ["downloaded", "installed"].includes(
                this.state.modsEx[instanceId].state,
              )
            : true;
        },
        hotKey: { code: 46 },
      },
      {
        icon: "show",
        title: "Show in Mods",
        action: this.showInMods,
        condition: (instanceId) => this.modAtLeastDownloaded(instanceId),
        singleRowAction: true,
        multiRowAction: false,
      },
      {
        icon: "toggle-disabled",
        title: "Ignore",
        action: this.ignoreSelected,
        condition: (instanceIds) =>
          arr(instanceIds).find(
            (id) => this.state.modsEx[id].collectionRule["ignored"] !== true,
          ) !== undefined,
      },
      {
        icon: "toggle-enabled",
        title: "Stop Ignoring",
        action: this.unignoreSelected,
        condition: (instanceIds) =>
          arr(instanceIds).find(
            (id) => this.state.modsEx[id].collectionRule["ignored"] === true,
          ) !== undefined,
      },
    ];

    this.mAttributes = [
      {
        id: "collection_status",
        name: "Status",
        description: "Is mod enabled in current profile",
        icon: "check-o",
        customRenderer: (mod: IModEx) => {
          const download =
            mod.archiveId !== undefined
              ? this.props.downloads[mod.archiveId]
              : undefined;

          return (
            <CollectionItemStatus
              t={this.props.t}
              mod={mod}
              download={download}
              notifications={this.props.notifications}
              container={this.mTableContainerRef}
              installing={this.mInstalling}
            />
          );
        },
        calc: (mod: IModEx) => {
          if (mod.collectionRule["ignored"]) {
            return ["Ignored"];
          } else if (mod.state === "installing") {
            return ["Installing", Math.floor(mod.progress * 100.0) / 100.0];
          } else if (mod.state === "downloading") {
            return ["Downloading", Math.floor(mod.progress * 100.0) / 100.0];
          } else if (mod.state === null) {
            if (mod.collectionRule.type === "recommends") {
              return ["Recommended"];
            } else {
              return ["Download Pending", "Pending"];
            }
          } else if (mod.state === "downloaded") {
            if (mod.collectionRule.type === "recommends") {
              return ["Recommended"];
            } else {
              return ["Install Pending", "Pending"];
            }
          }
          return [mod.enabled === true ? "Enabled" : "Disabled"];
        },
        placement: "table",
        isToggleable: false,
        edit: {},
        isSortable: true,
        sortFunc: (lhs: string[], rhs: string[]): number => {
          return STATUS_ORDER.indexOf(lhs[0]) - STATUS_ORDER.indexOf(rhs[0]);
        },
        filter: new OptionsFilter(
          [
            { value: "Enabled", label: "Enabled" },
            { value: "Disabled", label: "Disabled" },
            { value: "Installing", label: "Installing" },
            { value: "Downloading", label: "Downloading" },
            { value: "Pending", label: "Pending" },
            { value: "Recommended", label: "Not installed" },
            { value: "Ignored", label: "Ignored" },
          ],
          true,
          false,
        ),
      },
      {
        id: "required",
        name: "Required",
        description: "Is the mod required for this collection",
        placement: "table",
        calc: (mod: IModEx) => mod.collectionRule.type === "requires",
        edit: {},
        filter: new OptionsFilter(
          [
            { value: false, label: "Recommended" },
            { value: true, label: "Required" },
          ],
          false,
          false,
        ),
      },
      {
        id: "name",
        name: "Name",
        calc: (mod) =>
          mod.state !== null
            ? util.renderModReference(mod.collectionRule.reference, mod, {
                version: false,
              })
            : util.renderModReference(mod.collectionRule.reference, undefined, {
                version: false,
              }),
        placement: "table",
        edit: {},
        isToggleable: false,
        isDefaultSort: true,
        isSortable: true,
        filter: new TableTextFilter(true),
        sortFunc: (lhs: string, rhs: string, locale: string): number =>
          getCollator(locale).compare(lhs, rhs),
      },
      {
        id: "version",
        name: "Version",
        calc: (mod) => {
          const prefer = "+prefer";
          let verString =
            (mod.state !== null
              ? (mod.attributes.version ??
                mod.collectionRule.reference.versionMatch)
              : mod.collectionRule.reference.versionMatch) ?? "0.0.0";
          if (verString.endsWith(prefer)) {
            let sv: { version: string };
            try {
              sv = semver.minVersion(verString);
            } catch (e) {
              const { version, comparator } =
                this.extractAndRemoveComparators(verString);
              const coerced = util.coerceToSemver(
                version.slice(0, -prefer.length),
              );
              const range = (comparator ?? "") + coerced + prefer;
              try {
                sv = semver.minVersion(range);
              } catch (e2) {
                sv = { version: coerced };
              }
            }

            verString = sv.version;
          }
          return verString;
        },
        placement: "table",
        edit: {},
      },
      {
        id: "uploader",
        name: "Uploader",
        customRenderer: (mod: IModEx) => {
          const { t } = this.props;

          let name: string;
          let avatar: string;
          if (this.props.revisionInfo !== undefined) {
            const revMods: ICollectionRevisionMod[] =
              this.props.revisionInfo?.modFiles || [];
            const revMod = revMods.find((iter) => matchRepo(mod, iter.file));

            name = mod.attributes?.uploader || revMod?.file?.owner?.name;
            avatar =
              mod.attributes?.uploaderAvatar || revMod?.file?.owner?.avatar;
          } else if (mod.attributes !== undefined) {
            name = mod.attributes?.uploader;
            avatar = mod.attributes?.uploaderAvatar;
          }

          return (
            <div>
              <Image circle src={avatar || AVATAR_FALLBACK} />
              {name || t(AUTHOR_UNKNOWN)}
            </div>
          );
        },
        calc: (mod) => mod?.attributes?.author || this.props.t(AUTHOR_UNKNOWN),
        placement: "table",
        edit: {},
        isToggleable: false,
        isSortable: true,
      },
      {
        id: "instructions",
        name: "Instructions",
        customRenderer: (mod: IModEx) => {
          const instructions = this.getModInstructions(mod.id);
          if (instructions === undefined) {
            return null;
          }

          return (
            <tooltip.IconButton
              icon="details"
              tooltip={instructions}
              data-modid={mod.id}
              onClick={this.toggleInstructions}
            />
          );
        },
        calc: (mod) => {
          return this.getModInstructions(mod.id);
        },
        placement: "table",
        edit: {},
      },
    ];

    props.onAddCallback("viewCollectionTab", (tab: string) => {
      if (["instructions", "mods"].includes(tab)) {
        this.nextState.currentTab = tab;
      }
    });
  }

  public async componentDidMount() {
    const { collection, userInfo } = this.props;

    const { attributes } = collection ?? {};
    const { revisionId, collectionSlug, revisionNumber } = attributes ?? {};
    if (
      (revisionId !== undefined || collectionSlug !== undefined) &&
      userInfo !== undefined
    ) {
      const { infoCache } = this.props.driver;
      try {
        await infoCache.getRevisionInfo(
          revisionId,
          collectionSlug,
          revisionNumber,
        );
      } catch (err) {
        log("error", "failed to get remote info for revision", {
          revisionId,
          collectionSlug,
          revisionNumber,
          error: err.message,
        });
      }
    }

    const modsEx = this.initModsEx(this.props);
    this.nextState.modsEx = modsEx;
  }

  public async UNSAFE_componentWillReceiveProps(
    newProps: ICollectionPageProps,
  ) {
    // Note: notification changes are intentionally NOT checked here because
    // updateModsEx() is expensive (multiple iterations over all mods) and
    // notification updates fire very frequently during collection installation.
    // Per-mod progress is already updated when mods/downloads change.
    if (
      this.props.mods !== newProps.mods ||
      this.props.profile !== newProps.profile ||
      this.props.collection !== newProps.collection ||
      this.props.downloads !== newProps.downloads
    ) {
      this.nextState.modsEx = this.updateModsEx(this.props, newProps);
      const { collection } = this.props;
      const { attributes } = collection;
      const { revisionId, collectionSlug, revisionNumber } = attributes ?? {};
      if (revisionId !== undefined || collectionSlug !== undefined) {
        try {
          await this.props.driver.infoCache.getRevisionInfo(
            revisionId,
            collectionSlug,
            revisionNumber,
          );
        } catch (err) {
          log("error", "failed to get remote info for revision", {
            revisionId,
            collectionSlug,
            revisionNumber,
            error: err.message,
          });
        }
      }
    }
  }

  public shouldComponentUpdate(
    newProps: ICollectionPageProps & IConnectedProps,
    newState: IComponentState,
  ) {
    if (
      this.props.mods !== newProps.mods ||
      this.props.profile !== newProps.profile ||
      this.props.downloads !== newProps.downloads ||
      this.props.collection !== newProps.collection ||
      this.installingNotificationsChanged(this.props, newProps) ||
      this.props.activity.mods !== newProps.activity.mods ||
      this.props.revisionInfo !== newProps.revisionInfo ||
      this.props.showUpvoteResponse !== newProps.showUpvoteResponse ||
      this.props.showDownvoteResponse !== newProps.showDownvoteResponse ||
      this.state.currentTab !== newState.currentTab ||
      this.state.modSelection !== newState.modSelection ||
      this.state.modsEx !== newState.modsEx
    ) {
      return true;
    }
    return false;
  }

  public render(): JSX.Element {
    const {
      t,
      activity,
      className,
      collection,
      collectionInfo,
      driver,
      downloads,
      language,
      mods,
      onSuppressVoteResponse,
      onVoteSuccess,
      profile,
      revisionInfo,
      showUpvoteResponse,
      showDownvoteResponse,
      userInfo,
      votedSuccess,
    } = this.props;
    const { currentTab, modSelection, modsEx } = this.state;

    if (collection === undefined) {
      return null;
    }

    const incomplete =
      Object.values(modsEx).find(
        (mod) =>
          mod.state !== "installed" &&
          !mod.collectionRule["ignored"] &&
          mod.collectionRule.type === "requires",
      ) !== undefined;

    const totalSize = Object.values(modsEx).reduce((prev, mod) => {
      const size = util.getSafe(mod, ["attributes", "fileSize"], 0);
      return prev + size;
    }, 0);

    if (collection !== undefined) {
      // during installation we display only the remote information in the header area,
      // that's why we require driver.collectionInfo to be set
      this.mInstalling =
        incomplete &&
        !driver.installDone &&
        driver.collection?.id === collection?.id;
    } else {
      this.mInstalling = undefined;
    }

    const selection =
      (this.mInstalling && driver.collectionInfo !== undefined
        ? revisionInfo?.modFiles?.map?.((file) => ({
            local: undefined,
            remote: file,
          }))
        : modSelection) ?? [];

    return (
      <FlexLayout type="column" className={className}>
        <FlexLayout.Fixed className="collection-overview-panel">
          {selection.length > 0 ? (
            <CollectionOverviewSelection
              t={t}
              profile={profile}
              collection={collection}
              onDeselectMods={this.unselectMods}
              incomplete={incomplete}
              modSelection={selection}
            />
          ) : (
            <CollectionOverview
              t={t}
              language={language}
              profile={profile}
              collection={collection}
              totalSize={totalSize}
              showUpvoteResponse={showUpvoteResponse}
              showDownvoteResponse={showDownvoteResponse}
              revision={this.revisionMerged(collectionInfo, revisionInfo)}
              votedSuccess={votedSuccess}
              onSetEnabled={this.setEnabled}
              onShowMods={this.showMods}
              onClose={this.close}
              onClone={this.clone}
              onRemove={this.remove}
              onVoteSuccess={onVoteSuccess}
              onSuppressVoteResponse={onSuppressVoteResponse}
              incomplete={incomplete}
            />
          )}
        </FlexLayout.Fixed>
        <FlexLayout.Flex className="collection-mods-panel">
          <Tabs
            id="collection-view-tabs"
            activeKey={currentTab}
            onSelect={this.selectTab}
            unmountOnExit={true}
            mountOnEnter={true}
          >
            <Tab
              key="instructions"
              eventKey="instructions"
              title={t("Instructions")}
            >
              <Panel>
                <Panel.Body>
                  <CollectionInstructions
                    t={t}
                    collection={collection}
                    mods={mods}
                    onToggleInstructions={this.toggleInstructions}
                  />
                </Panel.Body>
              </Panel>
            </Tab>
            <Tab key="mods" eventKey="mods" title={t("Mods")}>
              <Panel ref={this.setTableContainerRef}>
                <Panel.Body>
                  <Table
                    tableId="collection-mods"
                    showDetails={false}
                    data={modsEx}
                    staticElements={this.mAttributes}
                    actions={this.mModActions}
                    onChangeSelection={this.changeModSelection}
                  />
                </Panel.Body>
              </Panel>
            </Tab>
          </Tabs>
        </FlexLayout.Flex>
        <FlexLayout.Fixed>
          <CollectionProgress
            t={t}
            isPremium={userInfo?.isPremium}
            mods={modsEx}
            profile={profile}
            downloads={downloads}
            totalSize={totalSize}
            activity={activity}
            onCancel={this.cancel}
            onPause={this.mInstalling ? this.pause : undefined}
            onResume={
              this.mInstalling
                ? undefined
                : driver.collection !== undefined && !driver.installDone
                  ? null // installing something else
                  : this.resume
            }
          />
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private selectTab = (tab: any) => {
    this.context.api.events.emit(
      "analytics-track-navigation",
      `collections/view/collection/${tab}`,
    );
    this.nextState.currentTab = tab;
  };

  private extractAndRemoveComparators = (
    versionString: string,
  ): { version: string; comparator: string | null } => {
    const comparatorPattern = /[\~\^><=]+/;
    const match = versionString.match(comparatorPattern);
    const comparator = match ? match[0] : null;
    const cleanedVersion = versionString.replace(comparatorPattern, "").trim();
    return { version: cleanedVersion, comparator: comparator };
  };

  private progress(props: ICollectionPageProps, mod: IModEx) {
    const { downloads, notifications } = props;

    if (mod.state === "downloading") {
      const { received, size } = downloads[mod.archiveId];
      if (!!size) {
        return received / size;
      }
    } else if (mod.state === "installing") {
      const notification = notifications.find(
        (noti) => noti.id === "install_" + mod.id,
      );
      if (notification !== undefined) {
        return (notification.progress ?? 100) / 100;
      } else {
        return 1;
      }
    }

    return 0;
  }

  private pause = () => {
    this.props.onPause(this.props.collection.id);
  };

  private cancel = () => {
    this.props.onCancel(this.props.collection.id);
  };

  private resume = () => {
    this.props.onResume(this.props.collection.id);
  };

  private setEnabled = (enable: boolean) => {
    const { collection, profile } = this.props;
    actions.setModsEnabled(
      this.context.api,
      profile.id,
      [collection.id],
      enable,
    );
  };

  private showMods = () => {
    const { collection } = this.props;
    const { api } = this.context;

    const batch = [];
    batch.push(actions.setAttributeFilter("mods", undefined, undefined));
    batch.push(
      actions.setAttributeFilter("mods", "dependencies", [
        "depends",
        collection.id,
        util.renderModName(collection),
      ]),
    );
    batch.push(actions.setAttributeSort("mods", "dependencies", "asc"));
    util.batchDispatch(api.store, batch);

    api.events.emit("show-main-page", "Mods");
  };

  private close = () => {
    this.props.onView(undefined);
  };

  private unselectMods = () => {
    this.nextState.modSelection = [];
  };

  private clone = (collectionId: string) => {
    const { modsEx } = this.state;

    const incomplete = Object.values(modsEx).filter(
      (mod) => mod.state !== "installed",
    );

    if (incomplete.length > 0) {
      return this.context.api.showDialog(
        "info",
        "Cloning incomplete",
        {
          text:
            "The collection you're trying to clone is incomplete. Vortex can " +
            "not include a mod in a collection that isn't installed so if you continue, " +
            "the clone will not include these missing mods..",
          message: incomplete.map((mod) => util.renderModName(mod)).join("\n"),
        },
        [
          { label: "Cancel" },
          {
            label: "Clone anyway",
            action: () => {
              this.props.onClone(collectionId);
            },
          },
        ],
      );
    } else {
      this.props.onClone(collectionId);
    }
  };

  private remove = (collectionId: string) => {
    this.props.onCancel(collectionId);
  };

  private changeModSelection = (modIds: string[]) => {
    const { revisionInfo } = this.props;
    const { modsEx } = this.state;

    this.nextState.modSelection = modIds.map((modId) => {
      const mod = modsEx[modId];
      return {
        local: mod,
        remote: revisionInfo?.modFiles?.find?.((file) =>
          matchRepo(mod, file.file),
        ),
      };
    });
  };

  private setTableContainerRef = (ref: any) => {
    this.mTableContainerRef =
      ref !== null ? (ReactDOM.findDOMNode(ref) as Element) : null;
  };

  private toggleInstructions = (evt: React.MouseEvent<any>) => {
    const modId = evt.currentTarget.getAttribute("data-modid");
    const { mods, onShowError, overlays } = this.props;
    const instructions = this.getModInstructions(modId);
    if (instructions === undefined) {
      // This shouldn't be possible
      const err = new util.ProcessCanceled("No instructions found", modId);
      err["attachLogOnReport"] = true;
      err["Collection"] = this.props.collection?.attributes?.collectionSlug;
      err["Revision"] = this.props.collection?.attributes?.revisionNumber;
      onShowError("Failed to display instructions", err, true);
      return;
    }

    const mod = mods[modId];
    const modName = util.renderModName(mod);
    if (overlays[modId]?.content !== undefined) {
      this.context.api.ext.dismissOverlay?.(modId);
    } else {
      this.context.api.ext.showOverlay?.(modId, modName, instructions, {
        x: evt.pageX,
        y: evt.pageY,
      });
    }
  };

  private getModInstructions = (modId: string) => {
    const { collection, mods } = this.props;
    const mod = mods[modId];
    const modRule = collection.rules?.find((rule) =>
      util.testModReference(mod, rule.reference),
    );
    return modRule?.["extra"]?.["instructions"];
  };

  private installingNotificationsChanged(
    oldProps: ICollectionPageProps,
    newProps: ICollectionPageProps,
  ): boolean {
    if (oldProps.notifications !== newProps.notifications) {
      const oldInstalling = oldProps.notifications.filter((noti) =>
        noti.id.startsWith(INSTALLING_NOTIFICATION_ID),
      );
      const newInstalling = newProps.notifications.filter((noti) =>
        noti.id.startsWith(INSTALLING_NOTIFICATION_ID),
      );

      return !_.isEqual(oldInstalling, newInstalling);
    } else {
      return false;
    }
  }

  private modAtLeastDownloaded = (instanceIds: string | string[]) => {
    const instanceId: string = Array.isArray(instanceIds)
      ? instanceIds[0]
      : instanceIds;
    const mod = this.state.modsEx[instanceId];
    return mod.state !== null;
  };

  private ignoreSelected = (modIds: string[]) => {
    const { collection, profile } = this.props;
    const { modsEx } = this.state;

    util.batchDispatch(
      this.context.api.store,
      modIds.reduce((prev: Redux.Action[], modId: string) => {
        prev.push(
          actions.addModRule(profile.gameId, collection.id, {
            ...modsEx[modId].collectionRule,
            ignored: true,
          } as any),
        );
        return prev;
      }, []),
    );
  };

  private unignoreSelected = (modIds: string[]) => {
    const { collection, profile } = this.props;
    const { modsEx } = this.state;

    util.batchDispatch(
      this.context.api.store,
      modIds.reduce((prev: Redux.Action[], modId: string) => {
        prev.push(
          actions.addModRule(profile.gameId, collection.id, {
            ...modsEx[modId].collectionRule,
            ignored: false,
          } as any),
        );
        return prev;
      }, []),
    );
  };

  private installManually = (modIds: string[]) => {
    const isInstallingCollection = selectors.getCollectionActiveSession(
      this.context.api.getState(),
    );
    if (isInstallingCollection) {
      return;
    }
    const { collection } = this.props;
    const { modsEx } = this.state;
    const rules = modIds
      .filter((modId) => modsEx[modId] !== undefined)
      .map((modId) => modsEx[modId].collectionRule);
    this.props.onInstallManually(collection.id, rules);
  };

  private removeSelected = (modIds: string[]) => {
    const isInstallingCollection = selectors.getCollectionActiveSession(
      this.context.api.getState(),
    );
    if (isInstallingCollection) {
      return;
    }
    const { t, collection, profile, onRemoveRule } = this.props;
    const { modsEx } = this.state;

    const filteredIds = modIds
      .filter((modId) => modsEx[modId] !== undefined)
      .filter(
        (modId) =>
          ["downloaded", "installed", null].indexOf(modsEx[modId].state) !== -1,
      );

    if (filteredIds.length === 0) {
      return;
    }

    const modNames = filteredIds.map((modId) =>
      modsEx[modId].state !== null
        ? util.renderModName(modsEx[modId], { version: true })
        : util.renderModReference(
            modsEx[modId].collectionRule.reference,
            undefined,
          ),
    );

    const checkboxes = [
      { id: "mod", text: t("Remove Mod"), value: true },
      { id: "archive", text: t("Delete Archive"), value: false },
    ];

    if (collection.attributes?.editable === true) {
      checkboxes.push({
        id: "collection",
        text: t("Remove from Collection"),
        value: false,
      });
    }

    this.context.api
      .showDialog(
        "question",
        "Confirm removal",
        {
          text: t("Do you really want to remove this mod?", {
            count: filteredIds.length,
            replace: { count: filteredIds.length },
          }),
          message: modNames.join("\n"),
          checkboxes,
        },
        [{ label: "Cancel" }, { label: "Remove" }],
      )
      .then((result: types.IDialogResult) => {
        const removeMods = result.action === "Remove" && result.input.mod;
        const removeArchive =
          result.action === "Remove" && result.input.archive;
        const removeRule =
          result.action === "Remove" && result.input.collection;

        const wereInstalled = filteredIds
          .filter(
            (key) =>
              modsEx[key] !== undefined && modsEx[key].state === "installed",
          )
          .map((key) => modsEx[key].id);

        const archiveIds = filteredIds
          .filter(
            (key) =>
              modsEx[key] !== undefined &&
              ["downloaded", "installed"].includes(modsEx[key].state) &&
              modsEx[key].archiveId !== undefined,
          )
          .map((key) => modsEx[key].archiveId);

        const rulesToRemove = filteredIds.filter(
          (key) => modsEx[key] !== undefined,
        );

        return (
          removeMods
            ? util.removeMods(this.context.api, profile.gameId, wereInstalled)
            : Bluebird.resolve()
        )
          .then(() => {
            if (removeArchive) {
              archiveIds.forEach((archiveId) => {
                this.context.api.events.emit(
                  "remove-download",
                  archiveId,
                  undefined,
                  { confirmed: true },
                );
              });
            }
            return Bluebird.resolve();
          })
          .then(() => {
            if (removeRule) {
              rulesToRemove.forEach((key) => {
                onRemoveRule(
                  profile.gameId,
                  collection.id,
                  modsEx[key].collectionRule,
                );
              });
            }
          });
      })
      .catch(util.ProcessCanceled, (err) => {
        this.context.api.sendNotification({
          id: "cant-remove-mod",
          type: "warning",
          title: "Failed to remove mods",
          message: err.message,
        });
      })
      .catch(util.UserCanceled, () => null)
      .catch((err) => {
        this.context.api.showErrorNotification(
          "Failed to remove selected mods",
          err,
        );
      });
  };

  private showInMods = (modIds: string[]) => {
    const { modsEx } = this.state;

    this.showMods();

    const modId = modsEx[modIds[0]].id;
    setTimeout(() => {
      this.context.api.events.emit("mods-scroll-to", modId);
      this.context.api.highlightControl("." + util.sanitizeCSSId(modId), 5000);
    }, 2000);
  };

  private updateModsEx(
    oldProps: ICollectionPageProps,
    newProps: ICollectionPageProps,
  ): { [modId: string]: IModEx } {
    // keep our cache updated
    const result = { ...this.state.modsEx };

    const modifiedDownloads: { [dlId: string]: types.IDownload } = util.objDiff(
      oldProps.downloads,
      newProps.downloads,
    );

    const modifiedMods: { [modId: string]: types.IMod } = util.objDiff(
      oldProps.mods,
      newProps.mods,
    );

    const modifiedState: { [modId: string]: { enabled: boolean } } =
      util.objDiff(
        oldProps.profile.modState ?? {},
        newProps.profile.modState ?? {},
      );

    const genRuleMap = (rules: types.IModRule[]) => {
      return (rules || []).reduce((prev, rule) => {
        prev[util.modRuleId(rule)] = rule;
        return prev;
      }, {});
    };

    const modifiedRules: { [ruleId: string]: types.IModRule } = util.objDiff(
      genRuleMap(oldProps.collection.rules),
      genRuleMap(newProps.collection.rules),
    );

    // remove any cache entry where the download or the mod has been
    // removed or changed
    Object.keys(modifiedDownloads)
      .filter((dlId) => dlId.startsWith("-"))
      .forEach((dlId) => {
        const refId = Object.keys(result).find(
          (iter) => result[iter]?.archiveId === dlId.slice(1),
        );
        delete result[refId];
      });

    const invalidateMod = (modId) => {
      const realId = modId.slice(1);
      const refId = Object.keys(result).find(
        (iter) => result[iter]?.id === realId,
      );
      delete result[refId];
    };

    Object.keys(modifiedMods)
      .filter((modId) => modId.startsWith("-"))
      .forEach(invalidateMod);

    Object.keys(modifiedState)
      .filter(
        (modId) =>
          modId.startsWith("-") ||
          modifiedState[modId]?.["-enabled"] !== undefined,
      )
      .forEach(invalidateMod);

    // refresh for any rule that doesn't currently have an entry or that was modified
    const { collection } = newProps;

    (collection.rules || [])
      .filter((rule) => ["requires", "recommends"].includes(rule.type))
      .forEach((rule) => {
        const id = util.modRuleId(rule);
        if (result[id] === undefined || modifiedRules[id] !== undefined) {
          result[id] = this.modFromRule(newProps, rule);
        }
      });

    // also remove and add entries if a rule was added/removed
    Object.keys(modifiedRules).forEach((ruleId) => {
      if (ruleId.startsWith("-")) {
        delete result[ruleId.slice(1)];
      } else if (ruleId.startsWith("+")) {
        result[ruleId.slice(1)] = this.modFromRule(
          newProps,
          modifiedRules[ruleId],
        );
      }
    });

    const { profile } = newProps;
    const { modsEx } = this.state;
    const pendingDL = Object.keys(modsEx).filter(
      (modId) => modsEx[modId]?.state === null,
    );
    const pendingInstall = Object.keys(modsEx).filter((modId) =>
      ["downloading", "downloaded", null].includes(modsEx[modId]?.state),
    );
    const pendingFinish = Object.keys(modsEx).filter((modId) =>
      ["installing", "installed"].includes(modsEx[modId]?.state),
    );

    // now, also check every added download or mod whether they may be relevant for any unfulfilled
    // rule
    Object.keys(modifiedDownloads)
      .filter((dlId) => dlId.startsWith("+"))
      .forEach((dlId) => {
        const download = newProps.downloads[dlId.slice(1)];
        const match = pendingDL.find((modId) =>
          testDownloadReference(
            download,
            modsEx[modId].collectionRule.reference,
          ),
        );
        if (match !== undefined) {
          result[match] = this.modFromDownload(
            dlId.slice(1),
            download,
            modsEx[match].collectionRule,
          );
        }
      });

    // this will get called for each mod that has been enabled, its state changed
    // or an attribute changed (since attribute changes might affect how rules get resolved to
    // actual mods)
    const updateMod = (modId) => {
      const realId = modId.startsWith("+") ? modId.slice(1) : modId;
      const mod = newProps.mods[realId];
      if (mod === undefined) {
        return;
      }
      if (mod.state === "installing") {
        // in this state the mod doesn't contain enough information to match a reference, go
        // through the download instead
        const dlId = mod.archiveId;
        const download = newProps.downloads[dlId];
        const match = pendingInstall.find((iter) =>
          testDownloadReference(
            download,
            modsEx[iter].collectionRule.reference,
          ),
        );
        if (match !== undefined) {
          result[match] = {
            ...this.modFromDownload(
              dlId,
              download,
              modsEx[match].collectionRule,
            ),
            id: modId.slice(1),
            state: "installing",
          };
        }
      } else {
        const match = pendingFinish.find((iter) =>
          util.testModReference(mod, modsEx[iter].collectionRule.reference),
        );
        if (match !== undefined) {
          result[match] = {
            ...mod,
            ...(profile.modState || {})[mod.id],
            collectionRule: modsEx[match].collectionRule,
          };
        }
      }
    };

    Object.keys(modifiedMods)
      .filter(
        (modId) =>
          !modId.startsWith("-") &&
          (modId.startsWith("+") ||
            modifiedMods[modId]["+state"] !== undefined ||
            modifiedMods[modId]["attributes"] !== undefined),
      )
      .forEach(updateMod);

    Object.keys(modifiedState)
      .filter((modId) => modifiedState[modId]?.["+enabled"] !== undefined)
      .forEach(updateMod);

    // finally, update any rule that had progress
    Object.keys(modifiedDownloads)
      .filter((dlId) => !dlId.startsWith("-") && !dlId.startsWith("+"))
      .forEach((dlId) => {
        let ruleId = Object.keys(result).find(
          (modId) => result[modId]?.archiveId === dlId,
        );
        if (
          ruleId === undefined &&
          newProps.downloads[dlId]?.modInfo?.referenceTag !== undefined
        ) {
          ruleId = Object.keys(result).find(
            (id) =>
              result[id]?.archiveId === undefined &&
              testDownloadReference(
                newProps.downloads[dlId],
                result[id]?.collectionRule.reference,
              ),
          );
          if (ruleId !== undefined) {
            result[ruleId] = {
              ...result[ruleId],
              archiveId: dlId,
              state: "downloading",
            };
          }
        }

        if (ruleId !== undefined) {
          result[ruleId] = {
            ...result[ruleId],
            progress: this.progress(newProps, result[ruleId]),
          };

          const dl = newProps.downloads[result[ruleId]?.archiveId];
          if (
            ["finished", "failed"].includes(dl.state) &&
            !pendingFinish.includes(ruleId)
          ) {
            result[ruleId].state = "downloaded";
          }
        }
      });

    newProps.notifications.forEach((noti) => {
      if (noti.id !== undefined && noti.id.startsWith("install_")) {
        const modId = noti.id.slice(8);
        const ruleId = Object.keys(result).find(
          (iter) => result[iter]?.id === modId,
        );
        if (ruleId !== undefined) {
          result[ruleId] = {
            ...result[ruleId],
            progress: this.progress(newProps, result[ruleId]),
          };
        }
      }
    });

    return result;
  }

  private modFromDownload(
    dlId: string,
    download: types.IDownload,
    rule: types.IModRule,
  ): IModEx {
    const modId =
      download.modInfo?.meta?.details?.modId ??
      download.modInfo?.nexus?.ids?.modId;

    return {
      id: dlId,
      type: "",
      installationPath: undefined,
      archiveId: dlId,
      enabledTime: 0,
      state: download.state === "finished" ? "downloaded" : "downloading",
      enabled: false,
      collectionRule: rule,
      attributes: {
        customFileName: download?.modInfo?.name,
        fileName:
          download.modInfo?.nexus?.fileInfo?.name ??
          util.renderModReference(rule.reference),
        fileSize: download.size ?? rule.reference.fileSize,
        name: dlId,
        version: download.modInfo?.nexus?.fileInfo?.mod_version,
        author: download.modInfo?.nexus?.modInfo?.author,
        uploader: download.modInfo?.nexus?.modInfo?.user?.name,
        uploaderId: download.modInfo?.nexus?.modInfo?.user?.id,
        category: download.modInfo?.nexus?.modInfo?.category_id,
        source: download.modInfo?.nexus !== undefined ? "nexus" : undefined,
        id: modId,
        downloadGame: Array.isArray(download.game)
          ? download.game[0]
          : download.game,
      },
    };
  }

  private modFromRule(
    props: ICollectionPageProps,
    rule: types.IModRule,
  ): IModEx {
    const { downloads, mods, profile } = props;

    const mod: types.IMod = util.findModByRef(rule.reference, mods);

    if (mod !== undefined) {
      return {
        ...mods[mod.id],
        ...profile.modState?.[mod.id],
        collectionRule: rule,
      };
    } else {
      const dlId: string = util.findDownloadByRef(rule.reference, downloads);

      if (dlId !== undefined) {
        return this.modFromDownload(dlId, downloads[dlId], rule);
      } else {
        // not downloaded and not installed yet
        const name = util.renderModReference(rule.reference, undefined);
        return {
          id: name,
          state: null,
          type: "",
          installationPath: undefined,
          enabledTime: 0,
          attributes: {
            fileSize: rule.reference.fileSize,
            ...(rule.extra || {}),
            // rule.extra.fileName is an actual file name, in the mod attributes we expect
            // it to be the name specified by the author
            fileName: rule.extra?.name,
          },
          enabled: false,
          collectionRule: rule,
        };
      }
    }
  }

  private initModsEx(props: ICollectionPageProps): { [modId: string]: IModEx } {
    const { collection } = props;

    return (collection?.rules ?? [])
      .filter((rule) => ["requires", "recommends"].includes(rule.type))
      .reduce<{ [modId: string]: IModEx }>((prev, rule) => {
        const id = util.modRuleId(rule);
        prev[id] = this.modFromRule(props, rule);
        return prev;
      }, {});
  }
}

function mapStateToProps(
  state: IStateEx,
  ownProps: ICollectionPageProps,
): IConnectedProps {
  const { nexus } = state.persistent as any;
  const { collection } = ownProps;

  let votedSuccess;

  let revisionInfo: IRevision;
  let collectionInfo: ICollection;

  if (collection?.attributes?.revisionId !== undefined) {
    revisionInfo =
      state.persistent.collections.revisions?.[collection.attributes.revisionId]
        ?.info;
    if (revisionInfo?.collection !== undefined) {
      collectionInfo =
        state.persistent.collections.collections?.[revisionInfo.collection.id]
          ?.info;
    }
    votedSuccess = revisionInfo?.metadata?.ratingValue ?? "abstained";
  }

  return {
    userInfo: nexus.userInfo,
    votedSuccess,
    activity: state.session.base.activity,
    language: state.settings.interface.language,
    overlays: state.session.overlays.overlays,
    collectionInfo,
    revisionInfo,
    showUpvoteResponse:
      state.settings.interface.usage["collection-upvote-response-dialog"] ??
      true,
    showDownvoteResponse:
      state.settings.interface.usage["collection-downvote-response-dialog"] ??
      true,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModEnabled: (profileId: string, modId: string, enable: boolean) =>
      dispatch(actions.setModEnabled(profileId, modId, enable)),
    onSetAttributeFilter: (
      tableId: string,
      filterId: string,
      filterValue: any,
    ) => dispatch(actions.setAttributeFilter(tableId, filterId, filterValue)),
    onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onShowError: (
      message: string,
      details?: string | Error | any,
      allowReport?: boolean,
    ) => util.showError(dispatch, message, details, { allowReport }),
    onSuppressVoteResponse: (response: "upvote" | "downvote") =>
      dispatch(
        actions.showUsageInstruction(
          `collection-${response}-response-dialog`,
          false,
        ),
      ),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(CollectionPage) as any as React.ComponentType<ICollectionPageProps>;
