import * as path from "path";

import { mdiPlus, mdiRefresh } from "@mdi/js";
import type { EndorsedStatus } from "@nexusmods/nexus-api";
import * as _ from "lodash";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  addExtension,
  removeExtension,
  setDialogVisible,
  setExtensionEnabled,
  setExtensionEndorsed,
} from "@/actions";
import { useMainContext } from "@/contexts";
import type { DropType } from "@/controls/Dropzone";
import Dropzone from "@/controls/Dropzone";
import type { ITableRowAction } from "@/controls/Table";
import Table from "@/controls/Table";
import { log } from "@/logging";
import type { IExtensionWithState } from "@/types/extensions";
import type { IExtensionState, IState } from "@/types/IState";
import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { relaunch } from "@/util/commandLine";
import * as selectors from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";
import { PageContent } from "@/views/components/Page/PageContent";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { SITE_ID } from "../gamemode_management/constants";
import { setShowBundledExtensions } from "./actions";
import { useDisplayOptionsAction } from "./hooks/useDisplayOptionsAction.hook";
import installExtension from "./installExtension";
import { extensionStateFromScan, findInstalled } from "./queries";
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

/** Keyed by extension id. */
type IExtensionStates = Record<string, IExtensionState>;

const EMPTY_EXTENSIONS: IExtensionStates = {};

// Normalise extension config so two sets differ only if the effective
// configuration does, leaving out the endorsement state.
const configId = (conf: IExtensionStates) =>
  Object.values(conf).map((ext) => ({
    enabled: ext.enabled ?? true,
    version: ext.version ?? "",
    remove: ext.remove ?? false,
  }));

export const ExtensionManager = ({
  active,
  localState,
  pageId,
  updateExtensions,
  onRefresh,
}: IExtensionManagerProps) => {
  const { t } = useTranslation(["common"]);
  const { api } = useMainContext();
  const dispatch = useDispatch();

  const extensions = useSelector((state: IState) => state.app.extensions) ?? EMPTY_EXTENSIONS;
  const loadFailures = useSelector((state: IState) => state.session.base.extLoadFailures);
  const downloads = useSelector((state: IState) => state.persistent.downloads.files);
  const downloadPath = useSelector(selectors.downloadPath);

  const showBundled = useSelector((state: IState) => state.session.extensions.showBundled);
  // The config as the page found it; a change from here means Vortex needs a restart.
  const [oldExtensions] = useState(extensions);

  // refs, so the columns and row actions below stay stable across renders.
  // Every rendered row, bundled ones included, so every row has an id here
  const extensionsRef = useRef<Record<string, IExtensionWithState>>({});
  // the persisted entries alone, to tell the two apart
  const persistedRef = useRef(extensions);
  persistedRef.current = extensions;

  const setEnabled = useCallback(
    (extName: string, enabled: boolean) => {
      const current = extensionsRef.current;
      const extId = Object.keys(current).find((iter) => current[iter].name === extName);
      if (extId === undefined) {
        log("warn", "toggling unknown extension", { extName, enabled });
        return;
      }

      log("info", "user toggling extension manually", { extId, enabled });

      if (persistedRef.current[extId] !== undefined) {
        dispatch(setExtensionEnabled(extId, enabled));
        return;
      }

      // a bundled extension has no entry until its enabled state needs recording
      const { loadFailures: _loadFailures, ...entry } = current[extId];
      dispatch(addExtension({ ...entry, enabled }));
    },
    [dispatch],
  );

  const staticColumns = useMemo(
    () =>
      getTableAttributes({
        onSetExtensionEnabled: setEnabled,
        onToggleExtensionEnabled: (extName: string) => {
          const current = extensionsRef.current;
          const extId = Object.keys(current).find((iter) => current[iter].name === extName);
          setEnabled(extName, !(current[extId]?.enabled ?? true));
        },
        onEndorseMod: (_gameId: string, modIdStr: string, endorseState: EndorsedStatus) => {
          const current = extensionsRef.current;
          const modId = parseInt(modIdStr, 10);
          const extId = Object.keys(current).find((iter) => current[iter].modId === modId);

          if (extId === undefined) {
            return;
          }

          api
            .emitAndAwait("endorse-nexus-mod", SITE_ID, modId, current[extId].version, endorseState)
            .then((endorsed: EndorsedStatus[]) => {
              dispatch(setExtensionEndorsed(extId, endorsed[0]));
            })
            .catch(() => {
              dispatch(setExtensionEndorsed(extId, "Undecided"));
            });
        },
      }),
    [api, dispatch, setEnabled],
  );

  const actions = useMemo<ITableRowAction[]>(
    () => [
      {
        icon: "delete",
        title: "Remove",
        action: (extIds: string[]) => {
          extIds.forEach((extId) => dispatch(removeExtension(extId)));
        },
        condition: (instanceId: string) => !extensionsRef.current[instanceId]?.bundled,
        singleRowAction: true,
      },
    ],
    [dispatch],
  );

  const bundled = useMemo(
    () =>
      (api?.getLoadedExtensions?.() ?? [])
        .filter((ext) => ext.dynamic && ext.info?.bundled)
        // one with an entry of its own is already a row
        .filter((ext) => findInstalled(extensions, { path: ext.path }) === undefined)
        .reduce<IExtensionStates>((prev, ext) => {
          // built like a persisted entry, since toggling the row persists it
          prev[ext.name] = { ...extensionStateFromScan(ext), name: ext.info?.name ?? ext.name };
          return prev;
        }, {}),
    [api, extensions],
  );

  const extensionsWithState = useMemo(() => {
    const allExtensions = showBundled ? { ...extensions, ...bundled } : extensions;

    return Object.keys(allExtensions).reduce<Record<string, IExtensionWithState>>((prev, id) => {
      const state = allExtensions[id];

      if ((!showBundled && state.bundled) || state.remove) {
        return prev;
      }

      prev[id] = {
        ...state,
        enabled: loadFailures[id] === undefined ? (state.enabled ?? true) : "failed",
        loadFailures: loadFailures[id] || [],
      };
      return prev;
    }, {});
  }, [bundled, extensions, loadFailures, showBundled]);

  extensionsRef.current = extensionsWithState;

  const dropExtension = useCallback(
    (type: DropType, extPaths: string[]) => {
      log("info", "installing extension(s) via drag and drop", { extPaths });

      const install = (extPath: string) =>
        installExtension(api, extPath, { analytics: { source: "manual" } })
          .then(() => true)
          .catch((err) => {
            api.showErrorNotification("Failed to install extension", err, { allowReport: false });

            return false;
          });

      const promises =
        type === "files"
          ? extPaths.map(install)
          : extPaths.map(async (url) => {
              const downloadId = await new Promise<string>((resolve, reject) => {
                api.events.emit<"start-download">(
                  "start-download",
                  [url],
                  { game: SITE_ID },
                  undefined,
                  (err, id) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    resolve(id);
                  },
                );
              });

              return await install(path.join(downloadPath, downloads[downloadId].localPath));
            });

      void (async () => {
        const results = await Promise.all(promises);
        if (results.some((success) => success)) {
          await updateExtensions();
        }
      })();
    },
    [api, downloadPath, downloads, updateExtensions],
  );

  const restartNeeded =
    localState.reloadNecessary || !_.isEqual(configId(extensions), configId(oldExtensions));

  const displayOptions = useDisplayOptionsAction({
    showBundled,
    t,
    onReset: () => dispatch(setShowBundledExtensions(false)),
    onToggleBundled: () => dispatch(setShowBundledExtensions(!showBundled)),
  });

  const toolbarActions: IToolbarAction[] = [
    {
      label: t("Update extensions"),
      iconPath: mdiRefresh,
      onClick: onRefresh,
    },
    {
      label: t("Browse extensions"),
      iconPath: mdiPlus,
      onClick: () => dispatch(setDialogVisible("browse-extensions")),
    },
    displayOptions,
  ];

  return (
    <Page active={active} pageId={pageId} scrollable={false}>
      <PageHeader
        isFullWidth
        pictogramName="puzzle-piece"
        subtitle={t("Manage extensions that add features and game support to Vortex.")}
        title={t("Extensions")}
      >
        <Toolbar className="flex-1 justify-end">
          <ToolbarGroup actions={toolbarActions} />
        </Toolbar>
      </PageHeader>

      {restartNeeded && (
        <PageContent isFullWidth>
          <Alert
            action={
              <Button brand="neutral" size="sm" onClick={() => relaunch()}>
                {t("Restart Vortex")}
              </Button>
            }
            className="shrink-0"
            severity="warning"
          >
            {t("You need to restart Vortex to apply changes.")}
          </Alert>
        </PageContent>
      )}

      <PageScroll isFullWidth className="flex min-h-full flex-col gap-y-4">
        <Table
          edgeToEdge
          stickyHeader
          actions={actions}
          data={extensionsWithState}
          multiSelect={false}
          staticElements={staticColumns}
          tableId="extensions"
        />
      </PageScroll>

      <PageContent isFullWidth className="p-6">
        <Dropzone
          accept={["files"]}
          dialogHint={t("Select extension file")}
          drop={dropExtension}
          icon="folder-download"
          style={{ margin: 0, width: "100%" }}
        />
      </PageContent>
    </Page>
  );
};
