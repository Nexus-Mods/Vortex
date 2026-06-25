import type {
  ICollection,
  ICollectionRevisionMod,
  IModFile,
  IRevision,
  RatingOptions,
} from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import Bluebird from "bluebird";
import type { TFunction } from "i18next";
import memoizeOne from "memoize-one";
import * as React from "react";
import { Image, Panel, Tab, Tabs } from "react-bootstrap";
import { connect } from "react-redux";
import type * as Redux from "redux";
import { createSelector } from "reselect";
import * as semver from "semver";

import { setAttributeFilter, setAttributeSort } from "../../../../actions/tables";
import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import Table, { type ITableRowAction } from "../../../../controls/Table";
import OptionsFilter from "../../../../controls/table/OptionsFilter";
import TableTextFilter from "../../../../controls/table/TextFilter";
import * as tooltip from "../../../../controls/TooltipControls";
import { log } from "../../../../logging";
import type { ICollectionModInstallInfo } from "../../../../types/collections/ICollectionInstallSession";
import type { IDialogResult } from "../../../../types/IDialog";
import type { INotification } from "../../../../types/INotification";
import type { IOverlay, IState } from "../../../../types/IState";
import type { ITableAttribute } from "../../../../types/ITableAttribute";
import { getCollectionActiveSession } from "../../../../util/collectionInstallSessionSelectors";
import {
  resyncCollectionSessionFromReality,
  resyncCollectionSessionRules,
} from "../../../../util/collectionSessionReconstruct";
import { ProcessCanceled, UserCanceled } from "../../../../util/CustomErrors";
import { showError } from "../../../../util/message";
import { getSafe } from "../../../../util/storeHelper";
import { batchDispatch, sanitizeCSSId } from "../../../../util/util";
import type { IDownload } from "../../../download_management/types/IDownload";
import { addModRule, removeModRule } from "../../../mod_management/actions/mods";
import type { IMod, IModRule } from "../../../mod_management/types/IMod";
import { coerceToSemver } from "../../../mod_management/util/coerceToSemver";
import renderModName, { renderModReference } from "../../../mod_management/util/modName";
import { findRuleByRef, isRequiredRule } from "../../../mod_management/util/testModReference";
import { shouldShowPremiumAd } from "../../../nexus_integration/selectors";
import { setModEnabled, setModsEnabled } from "../../../profile_management/actions/profiles";
import type { IProfile, IProfileMod } from "../../../profile_management/types/IProfile";
import { showUsageInstruction } from "../../../settings_interface/actions/interface";
import { AUTHOR_UNKNOWN, AVATAR_FALLBACK } from "../../constants";
import type { ICollectionItemRow } from "../../installSession/itemRows";
import { buildCollectionItemRows } from "../../installSession/itemRows";
import type InstallDriver from "../../util/InstallDriver";
import CollectionInstructions from "./CollectionInstructions";
import CollectionItemStatus from "./CollectionItemStatus";
import CollectionOverview from "./CollectionOverview";
import CollectionOverviewSelection from "./CollectionOverviewSelection";
import CollectionProgress from "./CollectionProgress";

export interface ICollectionPageProps {
  t: TFunction;
  className: string;
  profile: IProfile;
  collection: IMod;
  driver: InstallDriver;
  mods: { [modId: string]: IMod };
  downloads: { [dlId: string]: IDownload };
  notifications: INotification[];
  onAddCallback: (cbName: string, cb: (...args: any[]) => void) => void;
  onView: (modId: string) => void;
  onPause: (collectionId: string) => void;
  onCancel: (collectionId: string) => void;
  onClone: (collectionId: string) => void;
  onResume: (collectionId: string) => void;
  onInstallManually: (collectionId: string, rules: IModRule[]) => void;
  onVoteSuccess: (collectionId: string, success: boolean) => void;
}

interface IConnectedProps {
  userInfo: any;
  showPremiumAd: boolean;
  votedSuccess: RatingOptions;
  activity: { [id: string]: string };
  language: string;
  overlays: { [id: string]: IOverlay };
  collectionInfo: ICollection;
  revisionInfo: IRevision;
  showUpvoteResponse: boolean;
  showDownvoteResponse: boolean;
  // the collection's member-mod rows, keyed by rule id, derived from persistent
  // state + the active install session (replaces the old in-component itemRows cache)
  itemRows: Record<string, ICollectionItemRow>;
}

interface IActionProps {
  onSetModEnabled: (profileId: string, modId: string, enable: boolean) => void;
  onSetAttributeFilter: (tableId: string, filterId: string, filterValue: any) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IModRule) => void;
  onShowError: (message: string, details?: string | Error | any, allowReport?: boolean) => void;
  onSuppressVoteResponse: (response: "upvote" | "downvote") => void;
}

interface IComponentState {
  modSelection: Array<{ local: ICollectionItemRow; remote: ICollectionRevisionMod }>;
  currentTab: string;
  driverStep: string;
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
  "Failed",
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

function matchRepo(mod: ICollectionItemRow, ref: IModFile) {
  if (ref === null) {
    return false;
  }

  const modId = mod.attributes?.modId || mod.collectionRule?.reference?.repo?.modId;
  const fileId = mod.attributes?.fileId || mod.collectionRule?.reference?.repo?.fileId;

  if (
    modId === undefined ||
    fileId === undefined ||
    ref.modId === undefined ||
    ref.fileId === undefined
  ) {
    return false;
  }

  return modId.toString() === ref.modId.toString() && fileId.toString() === ref.fileId.toString();
}

class CollectionPage extends ComponentEx<IProps, IComponentState> {
  private mAttributes: Array<ITableAttribute<ICollectionItemRow>>;
  private mModActions: ITableRowAction[];
  private mInstalling: boolean = false;
  private mUnsubscribeDriver?: () => void;

  private revisionMerged = memoizeOne((collection: ICollection, revision: IRevision) => ({
    ...revision,
    collection,
  }));

  constructor(props: IProps) {
    super(props);
    this.initState({
      modSelection: [],
      currentTab: "instructions",
      driverStep: props.driver?.step ?? "prepare",
    });

    this.mModActions = [
      {
        icon: "install",
        title: "Install",
        action: this.installManually,
        condition: (instanceIds) => {
          const isInstallingCollection = getCollectionActiveSession(this.context.api.getState());
          if (isInstallingCollection) {
            return false;
          }
          const instanceId: string = Array.isArray(instanceIds) ? instanceIds[0] : instanceIds;
          const mod = this.props.itemRows[instanceId];
          return ["pending", "downloaded"].includes(mod.status);
        },
      },
      {
        icon: "delete",
        title: "Remove",
        action: this.removeSelected,
        condition: (instanceId) => {
          const isInstallingCollection = getCollectionActiveSession(this.context.api.getState());
          if (isInstallingCollection) {
            return false;
          }
          return typeof instanceId === "string"
            ? ["downloaded", "installed"].includes(this.props.itemRows[instanceId].status)
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
          arr(instanceIds).find((id) => this.props.itemRows[id].collectionRule.ignored !== true) !==
          undefined,
      },
      {
        icon: "toggle-enabled",
        title: "Stop Ignoring",
        action: this.unignoreSelected,
        condition: (instanceIds) =>
          arr(instanceIds).find((id) => this.props.itemRows[id].collectionRule.ignored === true) !==
          undefined,
      },
    ];

    this.mAttributes = [
      {
        id: "collection_status",
        name: "Status",
        description: "Is mod enabled in current profile",
        icon: "check-o",
        customRenderer: (mod: ICollectionItemRow) => {
          const download =
            mod.archiveId !== undefined ? this.props.downloads[mod.archiveId] : undefined;

          return <CollectionItemStatus download={download} mod={mod} t={this.props.t} />;
        },
        calc: (mod: ICollectionItemRow) => {
          const recommended = mod.collectionRule.type === "recommends";
          switch (mod.status) {
            case "ignored":
              return ["Ignored"];
            case "installing":
              return ["Installing"];
            case "downloading":
              return ["Downloading"];
            case "failed":
              return ["Failed"];
            case "pending":
              return recommended ? ["Recommended"] : ["Download Pending", "Pending"];
            case "optional":
              return ["Recommended"];
            case "downloaded":
              return recommended ? ["Recommended"] : ["Install Pending", "Pending"];
            default:
              // installed
              return [mod.enabled === true ? "Enabled" : "Disabled"];
          }
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
            { value: "Failed", label: "Failed" },
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
        calc: (mod: ICollectionItemRow) => isRequiredRule(mod.collectionRule),
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
          mod.status !== "pending"
            ? renderModReference(mod.collectionRule.reference, mod, {
                version: false,
              })
            : renderModReference(mod.collectionRule.reference, undefined, {
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
            (mod.status !== "pending"
              ? (mod.attributes.version ?? mod.collectionRule.reference.versionMatch)
              : mod.collectionRule.reference.versionMatch) ?? "0.0.0";
          if (verString.endsWith(prefer)) {
            let sv: { version: string };
            try {
              sv = semver.minVersion(verString);
            } catch (e) {
              const { version, comparator } = this.extractAndRemoveComparators(verString);
              const coerced = coerceToSemver(version.slice(0, -prefer.length));
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
        customRenderer: (mod: ICollectionItemRow) => {
          const { t } = this.props;

          let name: string;
          let avatar: string;
          if (this.props.revisionInfo !== undefined) {
            const revMods: ICollectionRevisionMod[] = this.props.revisionInfo?.modFiles || [];
            const revMod = revMods.find((iter) => matchRepo(mod, iter.file));

            name = mod.attributes?.uploader || revMod?.file?.owner?.name;
            avatar = mod.attributes?.uploaderAvatar || revMod?.file?.owner?.avatar;
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
        customRenderer: (mod: ICollectionItemRow) => {
          const instructions = this.getModInstructions(mod.id);
          if (instructions === undefined) {
            return null;
          }

          return (
            <tooltip.IconButton
              data-modid={mod.id}
              icon="details"
              tooltip={instructions}
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

    // subscribe synchronously, before any await: the disposer must be set by the time
    // componentWillUnmount can run, otherwise an unmount during the revision-info fetch below
    // would leave this handler registered on an unmounted instance. The item rows come from the
    // redux store via mapStateToProps; this hook only tracks the driver's own step (not in redux).
    this.mUnsubscribeDriver = this.props.driver.onUpdate(() => {
      if (this.props.driver.step !== this.state.driverStep) {
        this.nextState.driverStep = this.props.driver.step;
      }
    });

    const { attributes } = collection ?? {};
    const { revisionId, collectionSlug, revisionNumber } = attributes ?? {};
    if ((revisionId !== undefined || collectionSlug !== undefined) && userInfo !== undefined) {
      const { infoCache } = this.props.driver;
      try {
        await infoCache.getRevisionInfo(revisionId, collectionSlug, revisionNumber);
      } catch (err) {
        log("error", "failed to get remote info for revision", {
          revisionId,
          collectionSlug,
          revisionNumber,
          error: getErrorMessageOrDefault(err),
        });
      }
    }
  }

  public componentWillUnmount() {
    // drop the driver hook so a later triggerUpdate doesn't setState on this unmounted instance
    // (handlers accumulate otherwise: onUpdate is called fresh on every mount)
    this.mUnsubscribeDriver?.();
    this.mUnsubscribeDriver = undefined;
  }

  public async UNSAFE_componentWillReceiveProps(newProps: ICollectionPageProps) {
    // refresh the remote revision info when the inputs that affect it change. The item
    // rows themselves are derived in the store now, so there is no cache to update here.
    if (
      this.props.mods !== newProps.mods ||
      this.props.profile !== newProps.profile ||
      this.props.collection !== newProps.collection ||
      this.props.downloads !== newProps.downloads
    ) {
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
            error: getErrorMessageOrDefault(err),
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
      this.props.activity.mods !== newProps.activity.mods ||
      this.props.revisionInfo !== newProps.revisionInfo ||
      this.props.showUpvoteResponse !== newProps.showUpvoteResponse ||
      this.props.showDownvoteResponse !== newProps.showDownvoteResponse ||
      this.props.itemRows !== newProps.itemRows ||
      this.state.currentTab !== newState.currentTab ||
      this.state.modSelection !== newState.modSelection ||
      this.state.driverStep !== newState.driverStep
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
    const { currentTab, modSelection } = this.state;
    const { itemRows } = this.props;

    if (collection === undefined) {
      return null;
    }

    const incomplete =
      Object.values(itemRows).find(
        (mod) =>
          mod.status !== "installed" &&
          !mod.collectionRule.ignored &&
          isRequiredRule(mod.collectionRule),
      ) !== undefined;

    const totalSize = Object.values(itemRows).reduce((prev, mod) => {
      const size = getSafe(mod, ["attributes", "fileSize"], 0);
      return prev + size;
    }, 0);

    if (collection !== undefined) {
      // during installation we display only the remote information in the header area,
      // that's why we require driver.collectionInfo to be set
      this.mInstalling =
        incomplete && !driver.installDone && driver.collection?.id === collection?.id;
    } else {
      this.mInstalling = undefined;
    }

    // a collection install (this one or another) is in flight; gates Resume ("installing
    // something else") and disables Resync so a manual resync can't race InstallManager
    const installInFlight = driver.collection !== undefined && !driver.installDone;

    const selection =
      (this.mInstalling && driver.collectionInfo !== undefined
        ? revisionInfo?.modFiles?.map?.((file) => ({
            local: undefined,
            remote: file,
          }))
        : modSelection) ?? [];

    return (
      <FlexLayout className={className} type="column">
        <FlexLayout.Fixed className="collection-overview-panel">
          {selection.length > 0 ? (
            <CollectionOverviewSelection
              collection={collection}
              incomplete={incomplete}
              modSelection={selection}
              profile={profile}
              t={t}
              onDeselectMods={this.unselectMods}
            />
          ) : (
            <CollectionOverview
              collection={collection}
              incomplete={incomplete}
              language={language}
              profile={profile}
              revision={this.revisionMerged(collectionInfo, revisionInfo)}
              showDownvoteResponse={showDownvoteResponse}
              showUpvoteResponse={showUpvoteResponse}
              t={t}
              totalSize={totalSize}
              votedSuccess={votedSuccess}
              onClone={this.clone}
              onClose={this.close}
              onRemove={this.remove}
              onSetEnabled={this.setEnabled}
              onShowMods={this.showMods}
              onSuppressVoteResponse={onSuppressVoteResponse}
              onVoteSuccess={onVoteSuccess}
            />
          )}
        </FlexLayout.Fixed>

        <FlexLayout.Flex className="collection-mods-panel">
          <Tabs
            activeKey={currentTab}
            id="collection-view-tabs"
            mountOnEnter={true}
            unmountOnExit={true}
            onSelect={this.selectTab}
          >
            <Tab eventKey="instructions" key="instructions" title={t("Instructions")}>
              <Panel>
                <Panel.Body>
                  <CollectionInstructions
                    collection={collection}
                    mods={mods}
                    t={t}
                    onToggleInstructions={this.toggleInstructions}
                  />
                </Panel.Body>
              </Panel>
            </Tab>

            <Tab eventKey="mods" key="mods" title={t("Mods")}>
              <Panel>
                <Panel.Body>
                  <Table
                    actions={this.mModActions}
                    data={itemRows}
                    showDetails={false}
                    staticElements={this.mAttributes}
                    tableId="collection-mods"
                    onChangeSelection={this.changeModSelection}
                  />
                </Panel.Body>
              </Panel>
            </Tab>
          </Tabs>
        </FlexLayout.Flex>

        {(driver.step !== "review" || driver.collection?.id !== collection?.id) && (
          <FlexLayout.Fixed>
            <CollectionProgress
              activity={activity}
              downloads={downloads}
              mods={itemRows}
              profile={profile}
              resyncDisabled={installInFlight || (activity.mods ?? []).length > 0}
              showPremiumAd={this.props.showPremiumAd}
              t={t}
              totalSize={totalSize}
              onCancel={this.cancel}
              onPause={this.mInstalling ? this.pause : undefined}
              onResume={
                this.mInstalling
                  ? undefined
                  : installInFlight
                    ? null // installing something else
                    : this.resume
              }
              onResync={this.resync}
            />
          </FlexLayout.Fixed>
        )}
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

  private pause = () => {
    this.props.onPause(this.props.collection.id);
  };

  private cancel = () => {
    this.props.onCancel(this.props.collection.id);
  };

  private resume = () => {
    this.props.onResume(this.props.collection.id);
  };

  private resync = () => {
    const { t } = this.props;
    const changed = resyncCollectionSessionFromReality(this.context.api);
    this.context.api.sendNotification({
      id: "collection-resync",
      type: "success",
      title: "Collection re-synced",
      message:
        changed > 0
          ? t("{{count}} mod status(es) realigned", { replace: { count: changed } })
          : t("Already up to date"),
      displayMS: 4000,
    });
  };

  private setEnabled = (enable: boolean) => {
    const { collection, profile } = this.props;
    setModsEnabled(this.context.api, profile.id, [collection.id], enable);
  };

  private showMods = () => {
    const { collection } = this.props;
    const { api } = this.context;

    const batch = [];
    batch.push(setAttributeFilter("mods", undefined, undefined));
    batch.push(
      setAttributeFilter("mods", "dependencies", [
        "depends",
        collection.id,
        renderModName(collection),
      ]),
    );
    batch.push(setAttributeSort("mods", "dependencies", "asc"));
    batchDispatch(api.store, batch);

    api.events.emit("show-main-page", "Mods");
  };

  private close = () => {
    this.props.onView(undefined);
  };

  private unselectMods = () => {
    this.nextState.modSelection = [];
  };

  private clone = (collectionId: string) => {
    const { itemRows } = this.props;

    const incomplete = Object.values(itemRows).filter((mod) => mod.status !== "installed");

    if (incomplete.length > 0) {
      return this.context.api.showDialog(
        "info",
        "Cloning incomplete",
        {
          text:
            "The collection you're trying to clone is incomplete. Vortex can " +
            "not include a mod in a collection that isn't installed so if you continue, " +
            "the clone will not include these missing mods..",
          message: incomplete.map((mod) => renderModName(mod)).join("\n"),
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
    const { itemRows } = this.props;

    this.nextState.modSelection = modIds.map((modId) => {
      const mod = itemRows[modId];
      return {
        local: mod,
        remote: revisionInfo?.modFiles?.find?.((file) => matchRepo(mod, file.file)),
      };
    });
  };

  private toggleInstructions = (evt: React.MouseEvent<any>) => {
    const modId = evt.currentTarget.getAttribute("data-modid");
    const { mods, overlays } = this.props;
    const instructions = this.getModInstructions(modId);
    if (instructions === undefined) {
      // The button is only rendered when instructions exist (customRenderer guards this).
      // If reached anyway (race condition/state desync), log for debugging but don't
      // surface a confusing error dialog to the user or auto-report via VortexFeedback.
      log("warn", "toggleInstructions called but no instructions found", {
        modId,
        collectionSlug: this.props.collection?.attributes?.collectionSlug,
        revisionNumber: this.props.collection?.attributes?.revisionNumber,
      });
      return;
    }

    const mod = mods[modId];
    const modName = renderModName(mod);
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
    const modRule = findRuleByRef(collection.rules, mod);
    return modRule?.["extra"]?.["instructions"];
  };

  private modAtLeastDownloaded = (instanceIds: string | string[]) => {
    const instanceId: string = Array.isArray(instanceIds) ? instanceIds[0] : instanceIds;
    const mod = this.props.itemRows[instanceId];
    return mod.status !== "pending";
  };

  private ignoreSelected = (modIds: string[]) => {
    this.setRulesIgnored(modIds, true);
  };

  private unignoreSelected = (modIds: string[]) => {
    this.setRulesIgnored(modIds, false);
  };

  // toggle the durable `ignored` flag on the selected rules AND realign the active session
  // from reality for just those rules. The session is the source of truth while installing,
  // so without the second step an ignore/unignore made mid-install would not show until the
  // install finished (the row would keep its stale session status).
  private setRulesIgnored = (modIds: string[], ignored: boolean) => {
    const { collection, profile, itemRows } = this.props;

    const rules = modIds
      .filter((modId) => itemRows[modId] !== undefined)
      .map((modId) => ({ ...itemRows[modId].collectionRule, ignored }));
    if (rules.length === 0) {
      return;
    }

    batchDispatch(
      this.context.api.store,
      rules.map((rule) => addModRule(profile.gameId, collection.id, rule as any)),
    );
    // pass the rules carrying the new flag - the session holds a stale snapshot
    resyncCollectionSessionRules(this.context.api, rules);
  };

  private installManually = (modIds: string[]) => {
    const isInstallingCollection = getCollectionActiveSession(this.context.api.getState());
    if (isInstallingCollection) {
      return;
    }
    const { collection } = this.props;
    const { itemRows } = this.props;
    const rules = modIds
      .filter((modId) => itemRows[modId] !== undefined)
      .map((modId) => itemRows[modId].collectionRule);
    this.props.onInstallManually(collection.id, rules);
  };

  private removeSelected = (modIds: string[]) => {
    const isInstallingCollection = getCollectionActiveSession(this.context.api.getState());
    if (isInstallingCollection) {
      return;
    }
    const { t, collection, profile, onRemoveRule } = this.props;
    const { itemRows } = this.props;

    const filteredIds = modIds
      .filter((modId) => itemRows[modId] !== undefined)
      .filter(
        (modId) => ["downloaded", "installed", "pending"].indexOf(itemRows[modId].status) !== -1,
      );

    if (filteredIds.length === 0) {
      return;
    }

    const modNames = filteredIds.map((modId) =>
      itemRows[modId].status !== "pending"
        ? renderModName(itemRows[modId], { version: true })
        : renderModReference(itemRows[modId].collectionRule.reference, undefined),
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
      .then((result: IDialogResult) => {
        const removeMods = result.action === "Remove" && result.input.mod;
        const removeArchive = result.action === "Remove" && result.input.archive;
        const removeRule = result.action === "Remove" && result.input.collection;

        const wereInstalled = filteredIds
          .filter((key) => itemRows[key] !== undefined && itemRows[key].status === "installed")
          .map((key) => itemRows[key].id);

        const archiveIds = filteredIds
          .filter(
            (key) =>
              itemRows[key] !== undefined &&
              ["downloaded", "installed"].includes(itemRows[key].status) &&
              itemRows[key].archiveId !== undefined,
          )
          .map((key) => itemRows[key].archiveId);

        const rulesToRemove = filteredIds.filter((key) => itemRows[key] !== undefined);

        return Bluebird.resolve(
          removeMods
            ? removeMods(this.context.api, profile.gameId, wereInstalled)
            : Promise.resolve(),
        )
          .then(() => {
            if (removeArchive) {
              archiveIds.forEach((archiveId) => {
                this.context.api.events.emit("remove-download", archiveId, undefined, {
                  confirmed: true,
                });
              });
            }
            return Bluebird.resolve();
          })
          .then(() => {
            if (removeRule) {
              rulesToRemove.forEach((key) => {
                onRemoveRule(profile.gameId, collection.id, itemRows[key].collectionRule);
              });
            }
          });
      })
      .catch(ProcessCanceled, (err) => {
        this.context.api.sendNotification({
          id: "cant-remove-mod",
          type: "warning",
          title: "Failed to remove mods",
          message: err.message,
        });
      })
      .catch(UserCanceled, () => null)
      .catch((err) => {
        this.context.api.showErrorNotification(
          "Failed to remove selected mods",
          unknownToError(err),
        );
      });
  };

  private showInMods = (modIds: string[]) => {
    const { itemRows } = this.props;

    this.showMods();

    const modId = itemRows[modIds[0]].id;
    setTimeout(() => {
      this.context.api.events.emit("mods-scroll-to", modId);
      this.context.api.highlightControl("." + sanitizeCSSId(modId), 5000);
    }, 2000);
  };
}

// stable empty references so the memoized item-row selector doesn't recompute when a
// game has no mods / a profile has no mod state / no session is tracking the collection
const EMPTY_MODS: Record<string, IMod> = {};
const EMPTY_MOD_STATE: Record<string, IProfileMod> = {};
const EMPTY_SESSION_MODS: Record<string, ICollectionModInstallInfo> = {};

function sessionModsForCollection(
  state: IState,
  collectionId: string,
): Record<string, ICollectionModInstallInfo> {
  const session = getCollectionActiveSession(state);
  return session?.collectionId === collectionId ? session.mods : EMPTY_SESSION_MODS;
}

// per-instance factory so the item-row selector memoizes against this collection's
// inputs (collection rules, installed mods, downloads, mod state, active session)
function makeMapStateToProps(): (state: IState, ownProps: ICollectionPageProps) => IConnectedProps {
  // The prior row map, threaded back into each rebuild so unchanged rows keep their object
  // reference, which keeps download-progress churn cheap: progress is not a row field, so a tick
  // that only advances bytes rebuilds to a reference-equal map and connect skips the render.
  // Download state transitions (paused/failed/finished) flow through because they change row content.
  let lastRows: Record<string, ICollectionItemRow> = {};
  const getItemRows = createSelector(
    (_state: IState, ownProps: ICollectionPageProps) => ownProps.collection?.rules,
    (state: IState, ownProps: ICollectionPageProps) =>
      state.persistent.mods[ownProps.profile?.gameId] ?? EMPTY_MODS,
    (state: IState) => state.persistent.downloads.files,
    (_state: IState, ownProps: ICollectionPageProps) =>
      ownProps.profile?.modState ?? EMPTY_MOD_STATE,
    (state: IState, ownProps: ICollectionPageProps) =>
      sessionModsForCollection(state, ownProps.collection?.id),
    (rules, mods, downloads, modState, sessionMods) => {
      lastRows = buildCollectionItemRows(
        { rules: rules ?? [], mods, downloads, modState, sessionMods },
        lastRows,
      );
      return lastRows;
    },
  );

  return (state, ownProps) => {
    const { nexus } = state.persistent as any;
    const { collection } = ownProps;

    let votedSuccess;

    let revisionInfo: IRevision;
    let collectionInfo: ICollection;

    if (collection?.attributes?.revisionId !== undefined) {
      revisionInfo =
        state.persistent.collections.revisions?.[collection.attributes.revisionId]?.info;
      if (revisionInfo?.collection !== undefined) {
        collectionInfo =
          state.persistent.collections.collections?.[revisionInfo.collection.id]?.info;
      }
      votedSuccess = revisionInfo?.metadata?.ratingValue ?? "abstained";
    }

    return {
      userInfo: nexus.userInfo,
      showPremiumAd: shouldShowPremiumAd(state),
      votedSuccess,
      activity: state.session.base.activity,
      language: state.settings.interface.language,
      overlays: state.session.overlays.overlays,
      collectionInfo,
      revisionInfo,
      showUpvoteResponse:
        state.settings.interface.usage["collection-upvote-response-dialog"] ?? true,
      showDownvoteResponse:
        state.settings.interface.usage["collection-downvote-response-dialog"] ?? true,
      itemRows: getItemRows(state, ownProps),
    };
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModEnabled: (profileId: string, modId: string, enable: boolean) =>
      dispatch(setModEnabled(profileId, modId, enable)),
    onSetAttributeFilter: (tableId: string, filterId: string, filterValue: any) =>
      dispatch(setAttributeFilter(tableId, filterId, filterValue)),
    onRemoveRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(removeModRule(gameId, modId, rule)),
    onShowError: (message: string, details?: string | Error | any, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
    onSuppressVoteResponse: (response: "upvote" | "downvote") =>
      dispatch(showUsageInstruction(`collection-${response}-response-dialog`, false)),
  };
}

export default connect(
  makeMapStateToProps,
  mapDispatchToProps,
)(CollectionPage) as any as React.ComponentType<ICollectionPageProps>;
