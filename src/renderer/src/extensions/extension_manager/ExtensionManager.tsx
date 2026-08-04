import * as path from "path";

import { mdiPlus, mdiRefresh } from "@mdi/js";
import type { EndorsedStatus } from "@nexusmods/nexus-api";
import * as _ from "lodash";
import * as React from "react";
import { Alert, Button as BSButton } from "react-bootstrap";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import { setDialogVisible } from "@/actions";
import { removeExtension, setExtensionEnabled, setExtensionEndorsed } from "@/actions";
import { ComponentEx, connect, translate } from "@/controls/ComponentEx";
import type { DropType } from "@/controls/Dropzone";
import Dropzone from "@/controls/Dropzone";
import type { ITableRowAction } from "@/controls/Table";
import Table from "@/controls/Table";
import { log } from "@/logging";
import type { IExtensionWithState } from "@/types/extensions";
import type { IExtensionLoadFailure, IExtensionState, IState } from "@/types/IState";
import type { ITableAttribute } from "@/types/ITableAttribute";
import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { relaunch } from "@/util/commandLine";
import * as selectors from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";
import { PageContent } from "@/views/components/Page/PageContent";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import type { IDownload } from "../download_management/types/IDownload";
import { SITE_ID } from "../gamemode_management/constants";
import { DisplayOptions } from "./components/DisplayOptions";
import installExtension from "./installExtension";
import getTableAttributes from "./tableAttributes";

export interface IExtensionManagerProps {
  localState: {
    reloadNecessary: boolean;
  };
  updateExtensions: () => Promise<void>;
  onRefresh: () => void;
  active?: boolean;
  pageId?: string;
}

interface IConnectedProps {
  extensions: { [extId: string]: IExtensionState };
  downloads: { [dlId: string]: IDownload };
  downloadPath: string;
  loadFailures: { [extId: string]: IExtensionLoadFailure[] };
}

interface IActionProps {
  onSetExtensionEnabled: (extId: string, enabled: boolean) => void;
  onRemoveExtension: (extId: string) => void;
  onBrowseExtension: () => void;
}

type IProps = IExtensionManagerProps & IConnectedProps & IActionProps;

interface IComponentState {
  oldExtensions: { [extId: string]: IExtensionState };
  showBundled: boolean;
}

class ExtensionManager extends ComponentEx<IProps, IComponentState> {
  private staticColumns: ITableAttribute[];
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);

    this.initState({
      oldExtensions: props.extensions,
      showBundled: false,
    });

    this.actions = [
      {
        icon: "delete",
        title: "Remove",
        action: this.removeExtension,
        condition: (instanceId: string) => !this.props.extensions[instanceId]?.bundled,
        singleRowAction: true,
      },
    ];

    this.staticColumns = getTableAttributes({
      onSetExtensionEnabled: (extName: string, enabled: boolean) => {
        const { extensions, onSetExtensionEnabled } = this.props;
        const extId = Object.keys(extensions).find((iter) => extensions[iter].name === extName);
        log("info", "user toggling extension manually", { extId, enabled });
        onSetExtensionEnabled(extId, enabled);
      },
      onToggleExtensionEnabled: (extName: string) => {
        const { extensions, onSetExtensionEnabled } = this.props;
        const extId = Object.keys(extensions).find((iter) => extensions[iter].name === extName);
        const enabled = !(extensions[extId]?.enabled ?? true);
        log("info", "user toggling extension manually", { extId, enabled });
        onSetExtensionEnabled(extId, enabled);
      },
      onEndorseMod: (gameId: string, modIdStr: string, endorseState: EndorsedStatus) => {
        const { extensions } = this.props;
        const { api } = this.context;
        const modId: number = parseInt(modIdStr, 10);
        const extId = Object.keys(extensions).find((iter) => extensions[iter].modId === modId);

        if (extId === undefined) {
          return;
        }

        api
          .emitAndAwait(
            "endorse-nexus-mod",
            SITE_ID,
            modId,
            extensions[extId].version,
            endorseState,
          )
          .then((endorsed: EndorsedStatus[]) => {
            api.store.dispatch(setExtensionEndorsed(extId, endorsed[0]));
          })
          .catch(() => {
            api.store.dispatch(setExtensionEndorsed(extId, "Undecided"));
          });
      },
    });
  }

  public render(): JSX.Element {
    const { t, active, extensions, localState, pageId } = this.props;
    const { oldExtensions, showBundled } = this.state;

    const bundled = (this.context?.api?.getLoadedExtensions?.() ?? [])
      .filter((ext) => ext.dynamic && ext.info?.bundled)
      .reduce<{ [extId: string]: IExtensionState }>((prev, ext) => {
        prev[ext.name] = {
          enabled: true,
          version: ext.info?.version ?? "",
          remove: false,
          endorsed: "Undecided",
          name: ext.info?.name ?? ext.name,
          author: ext.info?.author ?? "Unknown",
          description: ext.info?.description ?? "",
          path: ext.path,
          bundled: true,
        };
        return prev;
      }, {});

    const allExtensions = showBundled ? { ...extensions, ...bundled } : extensions;

    const extensionsWithState = this.mergeExt(allExtensions, showBundled);

    // normalize extension config so they differ only if the effective configuration actually
    // differs, leaving out the endorsement state
    const configId = (conf: { [id: string]: IExtensionState }) =>
      Object.values(conf).map((ext) => ({
        enabled: ext.enabled ?? true,
        version: ext.version ?? "",
        remove: ext.remove ?? false,
      }));

    return (
      <Page active={active} pageId={pageId} scrollable={false}>
        <PageHeader
          isFullWidth
          pictogramName="puzzle-piece"
          subtitle={t("Manage extensions that add features and game support to Vortex.")}
          title={t("Extensions")}
        >
          <div className="flex shrink-0 items-center gap-x-2">
            <TooltipDelayGroup>
              <Tooltip content={t("Update extensions")} placement="bottom">
                <Button
                  appearance="subdued"
                  aria-label={t("Update extensions")}
                  brand="neutral"
                  leftIconPath={mdiRefresh}
                  size="sm"
                  onClick={this.onRefresh}
                />
              </Tooltip>

              <Tooltip content={t("Browse extensions")} placement="bottom">
                <Button
                  appearance="subdued"
                  aria-label={t("Browse extensions")}
                  brand="neutral"
                  leftIconPath={mdiPlus}
                  size="sm"
                  onClick={this.onBrowse}
                />
              </Tooltip>

              <DisplayOptions
                showBundled={showBundled}
                t={t}
                onReset={this.resetDisplayOptions}
                onToggleBundled={this.toggleBundled}
              />
            </TooltipDelayGroup>
          </div>
        </PageHeader>

        <PageScroll isFullWidth className="flex flex-col gap-y-4 px-6 pt-6">
          {localState.reloadNecessary || !_.isEqual(configId(extensions), configId(oldExtensions))
            ? this.renderReload()
            : null}

          <Table
            actions={this.actions}
            data={extensionsWithState}
            multiSelect={false}
            staticElements={this.staticColumns}
            tableId="extensions"
          />
        </PageScroll>

        <PageContent isFullWidth className="p-6">
          <Dropzone
            accept={["files"]}
            dialogHint={t("Select extension file")}
            drop={this.dropExtension}
            icon="folder-download"
            // The stand-alone dropzone insets itself by 10px; the page padding does that.
            style={{ margin: 0, width: "100%" }}
          />
        </PageContent>
      </Page>
    );
  }

  private onBrowse = () => {
    this.props.onBrowseExtension();
  };

  private onRefresh = () => {
    this.props.onRefresh();
  };

  private toggleBundled = () => {
    this.nextState.showBundled = !this.state.showBundled;
  };

  private resetDisplayOptions = () => {
    this.nextState.showBundled = false;
  };

  private dropExtension = (type: DropType, extPaths: string[]): void => {
    const { downloads } = this.props;
    log("info", "installing extension(s) via drag and drop", { extPaths });

    let promises: Promise<boolean>[];

    if (type === "files") {
      promises = extPaths.map((extPath) =>
        installExtension(this.context.api, extPath)
          .then(() => true)
          .catch((err) => {
            this.context.api.showErrorNotification("Failed to install extension", err, {
              allowReport: false,
            });

            return false;
          }),
      );
    } else {
      promises = extPaths.map(async (url) => {
        const downloadId = await new Promise<string>((resolve, reject) => {
          this.context.api.events.emit<"start-download">(
            "start-download",
            [url],
            { game: SITE_ID },
            undefined,
            (err, downloadId) => {
              if (err) {
                reject(err);
                return;
              }

              resolve(downloadId);
            },
          );
        });

        const downloadPath = path.join(this.props.downloadPath, downloads[downloadId].localPath);
        return await installExtension(this.context.api, downloadPath)
          .then(() => true)
          .catch((err) => {
            this.context.api.showErrorNotification("Failed to install extension", err, {
              allowReport: false,
            });

            return false;
          });
      });
    }

    void (async () => {
      const results = await Promise.all(promises);
      if (results.some((success) => success)) {
        await this.props.updateExtensions();
      }
    })();
  };

  private renderReload(): JSX.Element {
    const { t } = this.props;
    return (
      <Alert bsStyle="warning" style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flexGrow: 1 }}>{t("You need to restart Vortex to apply changes.")}</div>

        <BSButton onClick={this.restart}>{t("Restart")}</BSButton>
      </Alert>
    );
  }

  private restart = () => {
    relaunch();
  };

  private mergeExt(
    extensions: { [id: string]: IExtensionState },
    includeBundled: boolean,
  ): { [id: string]: IExtensionWithState } {
    const { loadFailures } = this.props;
    return Object.keys(extensions).reduce((prev, id) => {
      const state = extensions[id];

      if (!includeBundled && state.bundled) {
        return prev;
      }

      if (state.remove) {
        return prev;
      }

      const enabled = loadFailures[id] === undefined ? (state.enabled ?? true) : "failed";

      prev[id] = {
        ...state,
        enabled,
        loadFailures: loadFailures[id] || [],
      };
      return prev;
    }, {});
  }

  private removeExtension = (extIds: string[]) => {
    extIds.forEach((extId) => {
      this.props.onRemoveExtension(extId);
    });
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    extensions: state.app.extensions ?? {},
    loadFailures: state.session.base.extLoadFailures,
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetExtensionEnabled: (extId: string, enabled: boolean) =>
      dispatch(setExtensionEnabled(extId, enabled)),
    onRemoveExtension: (extId: string) => dispatch(removeExtension(extId)),
    onBrowseExtension: () => dispatch(setDialogVisible("browse-extensions")),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(ExtensionManager),
);
