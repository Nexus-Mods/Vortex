/* eslint-disable */
import { ICollectionInfo, ICollectionModRule } from "../../types/ICollection";
import { IExtensionFeature } from "../../util/extension";
import { getInterface } from "../../util/gameSupport";
import InstallDriver from "../../util/InstallDriver";
import { makeBiDirRule } from "../../util/transformCollection";

import { NAMESPACE } from "../../constants";

import { startAddModsToCollection } from "../../actions/session";

import FileOverrides, { IPathTools } from "./FileOverrides";
import CollectionGeneralPage from "./Instructions";
import ModRules from "./ModRules";
import ModsEditPage from "./ModsEditPage";

import { IRevision } from "@nexusmods/nexus-api";
import memoize from "memoize-one";
import * as React from "react";
import { Badge, Panel, Tab, Tabs } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import {
  actions,
  ComponentEx,
  FlexLayout,
  log,
  tooltip,
  types,
  util,
} from "vortex-api";

const INIT_PAGE = "mods";

export interface ICollectionEditBaseProps {
  pathTool: IPathTools;
  profile: types.IProfile;
  collection: types.IMod;
  mods: { [modId: string]: types.IMod };
  driver: InstallDriver;
  exts: IExtensionFeature[];
  onRemove: (modId: string) => void;
  onUpload: (modId: string) => void;
}

interface IConnectedProps {
  phaseColumnVisible: boolean;
  showPhaseUsage: boolean;
  showBinpatchWarning: boolean;
}

interface IActionProps {
  onSetModAttribute: (
    gameId: string,
    modId: string,
    key: string,
    value: any,
  ) => void;
  onAddRule: (gameId: string, modId: string, rule: types.IModRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) => void;
  onAddModsDialog: (collectionId: string) => void;
  onDismissPhaseUsage: () => void;
  onDismissBinpatchWarning: () => void;
  onShowPhaseColumn: () => void;
}

type ICollectionEditProps = ICollectionEditBaseProps &
  IConnectedProps &
  IActionProps;

interface ICollectionEditState {
  page: string;
  collectionInfo: ICollectionInfo;
  revision: IRevision;
}

const emptyCollectionInfo: ICollectionInfo = {
  domainName: "",
  author: "",
  authorUrl: "",
  name: "",
  description: "",
  installInstructions: "",
  gameVersions: [],
};

const emptyList = [];

class CollectionEdit extends ComponentEx<
  ICollectionEditProps,
  ICollectionEditState
> {
  private collectionRules = memoize(
    (
      rules: types.IModRule[],
      mods: { [modId: string]: types.IMod },
    ): ICollectionModRule[] => {
      const includedMods = rules
        .filter((rule) => ["requires", "recommends"].includes(rule.type))
        .reduce((prev, rule) => {
          const mod = util.findModByRef(rule.reference, mods);
          if (mod !== undefined) {
            prev[mod.id] = mod;
          }
          return prev;
        }, {});

      return Object.values(includedMods).reduce<ICollectionModRule[]>(
        (prev, mod: types.IMod) => {
          const source = util.makeModReference(mod);
          prev = [].concat(
            prev,
            (mod.rules || [])
              .filter(
                (rule) =>
                  !["requires", "recommends"].includes(rule.type) &&
                  rule.extra?.["automatic"] !== true,
              )
              .map((rule) => makeBiDirRule(source, rule)),
          );

          return prev;
        },
        [],
      );
    },
  );

  // used in case we do multiple attribute changes in a single frame
  private mAttributes: types.IMod["attributes"];

  constructor(props: ICollectionEditProps) {
    super(props);

    this.initState({
      page: INIT_PAGE,
      collectionInfo: emptyCollectionInfo,
      revision: undefined,
    });
  }

  public componentDidMount() {
    this.updateState(this.props);
  }

  public UNSAFE_componentWillReceiveProps(newProps: ICollectionEditProps) {
    this.mAttributes = newProps.collection?.attributes;
    if (
      util.getSafe(newProps.collection, ["id"], undefined) !==
      util.getSafe(this.props.collection, ["id"], undefined)
    ) {
      this.updateState(newProps);
    }
  }

  public render(): React.ReactNode {
    const {
      t,
      mods,
      collection,
      showBinpatchWarning,
      exts,
      onDismissBinpatchWarning,
      onDismissPhaseUsage,
      profile,
      showPhaseUsage,
      pathTool,
    } = this.props;
    const { page, revision } = this.state;

    if (profile === undefined) {
      return null;
    }

    const game = util.getGame(profile.gameId);

    const extInterfaces = exts.filter((ext) => ext.editComponent !== undefined);

    const uploadDisabled = this.testUploadPossible();

    const Interface = getInterface(profile.gameId);

    const nextRev = collection.attributes?.revisionNumber;

    const requiredModRules: ICollectionModRule[] = this.collectionRules(
      collection.rules ?? emptyList,
      mods,
    );

    return (
      <FlexLayout type="column">
        <FlexLayout.Fixed className="collection-edit-header">
          <FlexLayout type="row">
            <h3>
              {t("Edit Collection")} / {util.renderModName(collection)}
            </h3>
            <tooltip.IconButton
              icon="delete"
              tooltip={t("Remove this collection")}
              onClick={this.remove}
            >
              {t("Remove")}
            </tooltip.IconButton>
            <tooltip.IconButton
              icon="collection-export"
              tooltip={uploadDisabled ?? t("Upload to Nexus Mods")}
              onClick={this.upload}
              disabled={uploadDisabled !== undefined}
            >
              {t(nextRev !== undefined ? "Upload Update" : "Upload New")}
            </tooltip.IconButton>
            <tooltip.IconButton
              icon="open-ext"
              tooltip={t("Open site")}
              onClick={this.openUrl}
              disabled={revision === undefined}
            >
              {t("View Site")}
            </tooltip.IconButton>
          </FlexLayout>
          {t("Set up your mod collection's rules and site preferences.")}
        </FlexLayout.Fixed>
        <FlexLayout.Flex>
          <Tabs
            id="collection-edit-tabs"
            activeKey={page}
            onSelect={this.setCurrentPage}
          >
            <Tab
              key="mods"
              eventKey="mods"
              title={
                <div>
                  {t("Mods")}
                  <Badge>{(collection.rules || []).length}</Badge>
                </div>
              }
            >
              <Panel style={{ position: "relative" }}>
                <ModsEditPage
                  mods={mods}
                  collection={collection}
                  t={t}
                  onSetModVersion={null}
                  showPhaseUsage={showPhaseUsage}
                  showBinpatchWarning={showBinpatchWarning}
                  onAddRule={this.addRule}
                  onRemoveRule={this.removeRule}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                  onAddModsDialog={this.addModsDialog}
                  onDismissPhaseUsage={onDismissPhaseUsage}
                  onDismissBinpatchWarning={onDismissBinpatchWarning}
                  onShowPhaseColumn={this.showPhaseColumn}
                />
              </Panel>
            </Tab>
            <Tab key="mod-rules" eventKey="mod-rules" title={t("Mod Rules")}>
              <Panel>
                <ModRules
                  t={t}
                  collection={collection}
                  mods={mods}
                  rules={requiredModRules}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                />
              </Panel>
            </Tab>
            <Tab
              key="file-overrides"
              eventKey="file-overrides"
              title={t("File Overrides")}
            >
              <Panel>
                <FileOverrides
                  t={t}
                  collection={collection}
                  mods={mods}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                  pathTool={pathTool}
                />
              </Panel>
            </Tab>
            <Tab
              key="collection-instructions"
              eventKey="collection-instructions"
              title={t("Collection Instructions")}
            >
              <Panel>
                <CollectionGeneralPage
                  collection={collection}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                />
              </Panel>
            </Tab>
            {extInterfaces.map((ext) => (
              <Tab key={ext.id} eventKey={ext.id} title={ext.title(t)}>
                <Panel>
                  <ext.editComponent
                    t={t}
                    gameId={profile.gameId}
                    collection={collection}
                    revisionInfo={revision}
                    onSetCollectionAttribute={this.setCollectionAttribute}
                  />
                </Panel>
              </Tab>
            ))}
            {!!Interface ? (
              <Tab key="gamespecific" eventKey="gamespecific" title={game.name}>
                <Panel>
                  <Interface
                    t={t}
                    gameId={profile.gameId}
                    collection={collection}
                    revisionInfo={revision}
                    onSetCollectionAttribute={this.setCollectionAttribute}
                  />
                </Panel>
              </Tab>
            ) : null}
          </Tabs>
        </FlexLayout.Flex>
      </FlexLayout>
    );
  }

  private testUploadPossible(): string {
    const { t, collection } = this.props;
    const refMods: types.IModRule[] = (collection.rules ?? []).filter((rule) =>
      ["requires", "recommends"].includes(rule.type),
    );
    if (refMods.length === 0) {
      return t("Can't upload an empty collection") as string;
    } else {
      return undefined;
    }
  }

  private async updateState(props: ICollectionEditProps) {
    this.nextState.page = INIT_PAGE;
    if (props.collection !== undefined) {
      const { collection } = props;

      const { revisionId, collectionSlug, revisionNumber } =
        collection.attributes ?? {};

      if (revisionId !== undefined || collectionSlug !== undefined) {
        try {
          this.nextState.revision =
            (await this.props.driver.infoCache.getRevisionInfo(
              revisionId,
              collectionSlug,
              revisionNumber,
            )) ?? undefined;
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

  private trackTabChange = (page) => {
    const game = util.getGame(this.props.profile.gameId);
    const pageTracking = page === "gamespecific" ? game.name : page;
    this.context.api.events.emit(
      "analytics-track-navigation",
      `collections/workshop/collection/${pageTracking}`,
    );
  };

  private setCurrentPage = (page: any) => {
    this.trackTabChange(page);
    this.nextState.page = page;
  };

  private remove = () => {
    const { collection, onRemove } = this.props;
    onRemove(collection.id);
  };

  private upload = () => {
    const { collection, onUpload } = this.props;
    onUpload(collection.id);
  };

  private openUrl = () => {
    const collectionSlug =
      this.state.revision?.collection?.slug ??
      this.props.collection.attributes?.collectionSlug;
    if (collectionSlug === undefined) {
      return;
    }
    const { revision } = this.state;
    const { collection } = revision;

    if (
      collection?.game !== undefined &&
      revision?.revisionNumber !== undefined
    ) {
      this.context.api.events.emit(
        "analytics-track-click-event",
        "Collections",
        "View on site Workshop Collection",
      );
      util.opn(
        util.nexusModsURL(
          [
            collection.game.domainName,
            "collections",
            collection.slug,
            "revisions",
            revision.revisionNumber.toString(),
          ],
          {
            campaign: util.Campaign.GeneralNavigation,
            section: util.Section.Collections,
          },
        ),
      );
    }
  };

  private addRule = (rule: types.IModRule) => {
    const { profile, collection } = this.props;
    this.props.onAddRule(profile.gameId, collection.id, rule);
  };

  private removeRule = (rule: types.IModRule) => {
    const { profile, collection } = this.props;
    this.props.onRemoveRule(profile.gameId, collection.id, rule);
  };

  private setCollectionAttribute = (attrPath: string[], value: any) => {
    const { profile, collection } = this.props;
    if (this.mAttributes === undefined) {
      this.mAttributes = collection.attributes;
    }
    const attr = util.getSafe(this.mAttributes, ["collection"], {});
    const updated = util.setSafe(attr, attrPath, value);
    this.mAttributes = util.setSafe(this.mAttributes, ["collection"], updated);
    this.props.onSetModAttribute(
      profile.gameId,
      collection.id,
      "collection",
      updated,
    );
  };

  private addModsDialog = (collectionId: string) => {
    this.props.onAddModsDialog(collectionId);
  };

  private showPhaseColumn = () => {
    if (this.props.phaseColumnVisible === undefined) {
      this.props.onShowPhaseColumn();
    }
  };
}

function mapStateToProps(
  state: types.IState,
  ownProps: ICollectionEditBaseProps,
): IConnectedProps {
  const { settings } = state;
  return {
    phaseColumnVisible:
      settings.tables["collection-mods"]?.attributes?.phase?.enabled ?? false,
    showPhaseUsage: settings.interface.usage["collection-phase"] ?? true,
    showBinpatchWarning: settings.interface.usage["binpatch-warning"] ?? true,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (
      gameId: string,
      modId: string,
      key: string,
      value: any,
    ) => dispatch(actions.setModAttribute(gameId, modId, key, value)),
    onAddRule: (gameId: string, modId: string, rule: types.IModRule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId: string, modId: string, rule: types.IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onAddModsDialog: (collectionId: string) =>
      dispatch(startAddModsToCollection(collectionId)),
    onDismissPhaseUsage: () =>
      dispatch(actions.showUsageInstruction("collection-phase", false)),
    onDismissBinpatchWarning: () =>
      dispatch(actions.showUsageInstruction("binpatch-warning", false)),
    onShowPhaseColumn: () =>
      dispatch(actions.setAttributeVisible("collection-mods", "phase", true)),
  };
}

export default withTranslation([NAMESPACE, "common"])(
  connect(mapStateToProps, mapDispatchToProps)(CollectionEdit) as any,
) as React.ComponentClass<ICollectionEditBaseProps>;
