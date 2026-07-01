import type { IRevision } from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";
import memoize from "memoize-one";
import * as React from "react";
import { Badge, Panel, Tab, Tabs } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import type * as Redux from "redux";

import * as actions from "../../../../actions";
import { ComponentEx } from "../../../../controls/ComponentEx";
import FlexLayout from "../../../../controls/FlexLayout";
import * as tooltip from "../../../../controls/TooltipControls";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import type { IMod, IModRule } from "../../../../extensions/mod_management/types/IMod";
import { findModByRef } from "../../../../extensions/mod_management/util/findModByRef";
import renderModName from "../../../../extensions/mod_management/util/modName";
import { makeModReference } from "../../../../extensions/mod_management/util/modReference";
import { isDependencyRule } from "../../../../extensions/mod_management/util/testModReference";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import { log } from "../../../../logging";
import type { IState } from "../../../../types/IState";
import opn from "../../../../util/opn";
import { getSafe, setSafe } from "../../../../util/storeHelper";
import { Campaign, nexusModsURL, Section } from "../../../../util/util";
import { startAddModsToCollection } from "../../actions/session";
import { NAMESPACE } from "../../constants";
import type { ICollectionInfo, ICollectionModRule } from "../../types/ICollection";
import type { IExtensionFeature } from "../../util/extension";
import { getInterface } from "../../util/gameSupport";
import type InstallDriver from "../../util/InstallDriver";
import { makeBiDirRule } from "../../util/transformCollection";
import type { IPathTools } from "./FileOverrides";
import FileOverrides from "./FileOverrides";
import CollectionGeneralPage from "./Instructions";
import ModRules from "./ModRules";
import ModsEditPage from "./ModsEditPage";

const INIT_PAGE = "mods";

export interface ICollectionEditBaseProps {
  pathTool: IPathTools;
  profile: IProfile;
  collection: IMod;
  mods: { [modId: string]: IMod };
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
  onSetModAttribute: (gameId: string, modId: string, key: string, value: any) => void;
  onAddRule: (gameId: string, modId: string, rule: IModRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IModRule) => void;
  onAddModsDialog: (collectionId: string) => void;
  onDismissPhaseUsage: () => void;
  onDismissBinpatchWarning: () => void;
  onShowPhaseColumn: () => void;
}

type ICollectionEditProps = ICollectionEditBaseProps & IConnectedProps & IActionProps;

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

class CollectionEdit extends ComponentEx<ICollectionEditProps, ICollectionEditState> {
  private collectionRules = memoize(
    (rules: IModRule[], mods: { [modId: string]: IMod }): ICollectionModRule[] => {
      const includedMods = rules
        .filter((rule) => isDependencyRule(rule))
        .reduce((prev, rule) => {
          const mod = findModByRef(rule.reference, mods);
          if (mod !== undefined) {
            prev[mod.id] = mod;
          }
          return prev;
        }, {});

      return Object.values(includedMods).reduce<ICollectionModRule[]>((prev, mod: IMod) => {
        const source = makeModReference(mod);
        prev = [].concat(
          prev,
          (mod.rules || [])
            .filter((rule) => !isDependencyRule(rule) && rule.extra?.["automatic"] !== true)
            .map((rule) => makeBiDirRule(source, rule)),
        );

        return prev;
      }, []);
    },
  );

  // used in case we do multiple attribute changes in a single frame
  private mAttributes: IMod["attributes"];

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
      getSafe(newProps.collection, ["id"], undefined) !==
      getSafe(this.props.collection, ["id"], undefined)
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

    const game = getGame(profile.gameId);

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
              {t("Edit Collection")} / {renderModName(collection)}
            </h3>

            <tooltip.IconButton
              icon="delete"
              tooltip={t("Remove this collection")}
              onClick={this.remove}
            >
              {t("Remove")}
            </tooltip.IconButton>

            <tooltip.IconButton
              disabled={uploadDisabled !== undefined}
              icon="collection-export"
              set="collections"
              tooltip={uploadDisabled ?? t("Upload to Nexus Mods")}
              onClick={this.upload}
            >
              {t(nextRev !== undefined ? "Upload Update" : "Upload New")}
            </tooltip.IconButton>

            <tooltip.IconButton
              disabled={revision === undefined}
              icon="open-ext"
              tooltip={t("Open site")}
              onClick={this.openUrl}
            >
              {t("View Site")}
            </tooltip.IconButton>
          </FlexLayout>

          {t("Set up your mod collection's rules and site preferences.")}
        </FlexLayout.Fixed>

        <FlexLayout.Flex>
          <Tabs activeKey={page} id="collection-edit-tabs" onSelect={this.setCurrentPage}>
            <Tab
              eventKey="mods"
              key="mods"
              title={
                <div>
                  {t("Mods")}

                  <Badge>{(collection.rules || []).length}</Badge>
                </div>
              }
            >
              <Panel style={{ position: "relative" }}>
                <ModsEditPage
                  collection={collection}
                  mods={mods}
                  showBinpatchWarning={showBinpatchWarning}
                  showPhaseUsage={showPhaseUsage}
                  t={t}
                  onAddModsDialog={this.addModsDialog}
                  onAddRule={this.addRule}
                  onDismissBinpatchWarning={onDismissBinpatchWarning}
                  onDismissPhaseUsage={onDismissPhaseUsage}
                  onRemoveRule={this.removeRule}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                  onSetModVersion={null}
                  onShowPhaseColumn={this.showPhaseColumn}
                />
              </Panel>
            </Tab>

            <Tab eventKey="mod-rules" key="mod-rules" title={t("Mod Rules")}>
              <Panel>
                <ModRules
                  collection={collection}
                  mods={mods}
                  rules={requiredModRules}
                  t={t}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                />
              </Panel>
            </Tab>

            <Tab eventKey="file-overrides" key="file-overrides" title={t("File Overrides")}>
              <Panel>
                <FileOverrides
                  collection={collection}
                  mods={mods}
                  pathTool={pathTool}
                  t={t}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                />
              </Panel>
            </Tab>

            <Tab
              eventKey="collection-instructions"
              key="collection-instructions"
              title={t("Collection Instructions")}
            >
              <Panel>
                <CollectionGeneralPage
                  collection={collection}
                  gameId={profile.gameId}
                  onSetCollectionAttribute={this.setCollectionAttribute}
                />
              </Panel>
            </Tab>

            {extInterfaces.map((ext) => (
              <Tab eventKey={ext.id} key={ext.id} title={ext.title(t)}>
                <Panel>
                  <ext.editComponent
                    collection={collection}
                    gameId={profile.gameId}
                    revisionInfo={revision}
                    t={t}
                    onSetCollectionAttribute={this.setCollectionAttribute}
                  />
                </Panel>
              </Tab>
            ))}

            {Interface ? (
              <Tab eventKey="gamespecific" key="gamespecific" title={game.name}>
                <Panel>
                  <Interface
                    collection={collection}
                    gameId={profile.gameId}
                    revisionInfo={revision}
                    t={t}
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
    const refMods: IModRule[] = (collection.rules ?? []).filter((rule) => isDependencyRule(rule));
    if (refMods.length === 0) {
      return t("Can't upload an empty collection");
    } else {
      return undefined;
    }
  }

  private async updateState(props: ICollectionEditProps) {
    this.nextState.page = INIT_PAGE;
    if (props.collection !== undefined) {
      const { collection } = props;

      const { revisionId, collectionSlug, revisionNumber } = collection.attributes ?? {};

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
            error: getErrorMessageOrDefault(err),
          });
        }
      }
    }
  }

  private trackTabChange = (page) => {
    const game = getGame(this.props.profile.gameId);
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
      this.state.revision?.collection?.slug ?? this.props.collection.attributes?.collectionSlug;
    if (collectionSlug === undefined) {
      return;
    }
    const { revision } = this.state;
    const { collection } = revision;

    if (collection?.game !== undefined && revision?.revisionNumber !== undefined) {
      this.context.api.events.emit(
        "analytics-track-click-event",
        "Collections",
        "View on site Workshop Collection",
      );
      opn(
        nexusModsURL(
          [
            collection.game.domainName,
            "collections",
            collection.slug,
            "revisions",
            revision.revisionNumber.toString(),
          ],
          {
            campaign: Campaign.GeneralNavigation,
            section: Section.Collections,
          },
        ),
      );
    }
  };

  private addRule = (rule: IModRule) => {
    const { profile, collection } = this.props;
    this.props.onAddRule(profile.gameId, collection.id, rule);
  };

  private removeRule = (rule: IModRule) => {
    const { profile, collection } = this.props;
    this.props.onRemoveRule(profile.gameId, collection.id, rule);
  };

  private setCollectionAttribute = (attrPath: string[], value: any) => {
    const { profile, collection } = this.props;
    if (this.mAttributes === undefined) {
      this.mAttributes = collection.attributes;
    }
    const attr = getSafe(this.mAttributes, ["collection"], {});
    const updated = setSafe(attr, attrPath, value);
    this.mAttributes = setSafe(this.mAttributes, ["collection"], updated);
    this.props.onSetModAttribute(profile.gameId, collection.id, "collection", updated);
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

function mapStateToProps(state: IState, ownProps: ICollectionEditBaseProps): IConnectedProps {
  const { settings } = state;
  return {
    phaseColumnVisible: settings.tables["collection-mods"]?.attributes?.phase?.enabled ?? false,
    showPhaseUsage: settings.interface.usage["collection-phase"] ?? true,
    showBinpatchWarning: settings.interface.usage["binpatch-warning"] ?? true,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (gameId: string, modId: string, key: string, value: any) =>
      dispatch(actions.setModAttribute(gameId, modId, key, value)),
    onAddRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onAddModsDialog: (collectionId: string) => dispatch(startAddModsToCollection(collectionId)),
    onDismissPhaseUsage: () => dispatch(actions.showUsageInstruction("collection-phase", false)),
    onDismissBinpatchWarning: () =>
      dispatch(actions.showUsageInstruction("binpatch-warning", false)),
    onShowPhaseColumn: () =>
      dispatch(actions.setAttributeVisible("collection-mods", "phase", true)),
  };
}

export default withTranslation([NAMESPACE, "common"])(
  connect(mapStateToProps, mapDispatchToProps)(CollectionEdit) as any,
) as React.ComponentClass<ICollectionEditBaseProps>;
