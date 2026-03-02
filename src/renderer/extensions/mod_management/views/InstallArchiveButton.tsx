import type { ButtonType } from "../../../controls/IconBar";
import ToolbarIcon from "../../../controls/ToolbarIcon";
import type { IState } from "../../../types/IState";
import { fileMD5 } from "../../../util/checksum";
import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";

import { activeGameId } from "../../../util/selectors";
import { batchDispatch } from "../../../util/util";

import { setModAttribute } from "../actions/mods";
import metaLookupMatch from "../util/metaLookupMatch";

import NXMUrl from "../../nexus_integration/NXMUrl";

import * as React from "react";
import { getErrorMessageOrDefault } from "@vortex/shared";

export interface IBaseProps {
  buttonType: ButtonType;
}

interface IConnectedProps {
  gameMode: string;
  copyOnIFF: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class InstallButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
      <ToolbarIcon
        id="install-from-archive"
        icon="select-install"
        text={t("Install From File")}
        onClick={this.startInstallFile}
      />
    );
  }

  private startInstallFile = () => {
    const options: Electron.OpenDialogOptions = {
      properties: ["openFile"],
    };

    this.context.api.selectFile(options).then((result) => {
      const { api } = this.context;
      if (result !== undefined) {
        if (this.props.copyOnIFF) {
          api.events.emit("import-downloads", [result], (dlIds: string[]) => {
            dlIds.forEach((dlId) => {
              api.events.emit("start-install-download", dlId);
            });
          });
        } else {
          api.events.emit("start-install", result, (error, id: string) => {
            if (error) {
              return;
            }
            const state = api.getState();
            const gameId = activeGameId(state);
            return Promise.all([fileMD5(result), fs.statAsync(result)])
              .then((res) =>
                api.lookupModMeta(
                  {
                    fileMD5: res[0],
                    filePath: result,
                    gameId,
                    fileSize: res[1].size,
                  },
                  false,
                ),
              )
              .then((modInfo) => {
                const match = metaLookupMatch(modInfo, result, gameId);
                if (match !== undefined) {
                  const actions = [];
                  const info = match.value;
                  const setInfo = (key: string, value: any) => {
                    if (value !== undefined) {
                      actions.push(setModAttribute(gameId, id, key, value));
                    }
                  };
                  try {
                    const nxmUrl = new NXMUrl(info.sourceURI);
                    setInfo("source", "nexus");
                    setInfo("description", info.details.description);
                    setInfo("category", info.details.category);
                    setInfo("downloadGame", nxmUrl.gameId);
                    setInfo("fileId", nxmUrl.fileId);
                    setInfo("modId", nxmUrl.modId);
                    batchDispatch(api.store, actions);
                  } catch (err) {
                    setInfo("source", "unknown");
                  }
                }
              })
              .catch((err) => {
                log("warn", "failed to look up mod meta info", {
                  message: getErrorMessageOrDefault(err),
                });
              });
          });
        }
      }
    });
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    copyOnIFF: state.settings.downloads.copyOnIFF,
  };
}

export default translate(["common"])(
  connect(mapStateToProps)(InstallButton),
) as React.ComponentClass<IBaseProps>;
