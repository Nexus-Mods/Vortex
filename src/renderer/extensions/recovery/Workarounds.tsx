import type PromiseBB from "bluebird";
import * as path from "path";
import * as React from "react";
import { Button, ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";
import type {
  DialogActions,
  DialogType,
  ICheckbox,
  IDialogContent,
  IDialogResult,
} from "../../actions";
import { showDialog } from "../../actions";
import type { IState } from "../../types/IState";
import { getApplication } from "../../util/application";
import { ComponentEx } from "../../controls/ComponentEx";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import relativeTime from "../../util/relativeTime";
import { FULL_BACKUP_PATH } from "../../store/store";
import { spawnSelf } from "../../util/util";
import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";

export interface IBaseProps {
  onCreateManualBackup: () => void;
}

interface IConnectedProps {}

interface IActionProps {
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => PromiseBB<IDialogResult>;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, onCreateManualBackup } = this.props;

    return (
      <div className="danger-outline">
        <div className="danger-heading">{t("Caution")}</div>
        <form>
          <FormGroup id="database-backups" controlId="restore-backup">
            <ControlLabel>{t("Database backup")}</ControlLabel>
            <div className="button-container">
              <Button onClick={this.onSelectBackup}>
                {t("Restore") + "..."}
              </Button>
            </div>
            <div className="button-container">
              <Button onClick={onCreateManualBackup}>
                {t("Create Backup")}
              </Button>
            </div>
            <HelpBlock>
              <div>
                {t(
                  "Vortex stores application settings as well as mod meta data and a lot " +
                    "of other important things in a database. Here you can restore a " +
                    "backup of this database (Vortex creates automatic updates). " +
                    "Please note that after this reset, the state may not agree with other " +
                    "data stored on disk, e.g. Vortex may report external file changes for things " +
                    "that it installed itself. Please be very careful to not lose data. " +
                    'We strongly advise you use this only in an emergency, not as an "undo" ' +
                    "function.",
                )}
              </div>
              <div>
                {t(
                  "You can have up to 3 backups: One is automatically created whenever Vortex " +
                    "starts up with no issue, one is automatically created hourly (while using " +
                    "Vortex) and one you can create manually.",
                )}
              </div>
            </HelpBlock>
          </FormGroup>
        </form>
      </div>
    );
  }

  private onSelectBackup = async () => {
    const { t, onShowDialog } = this.props;
    const basePath = path.join(getVortexPath("temp"), FULL_BACKUP_PATH);
    const locale = this.context.api.locale();

    const choices: ICheckbox[] = [
      {
        id: "from_file",
        text: t("From file (DANGEROUS!)..."),
        value: false,
      },
    ];
    try {
      const files: string[] = await fs.readdirAsync(basePath);
      await Promise.all(
        files.map(async (name) => {
          const stats: fs.Stats = await fs.statAsync(path.join(basePath, name));
          if (!stats.isFile()) {
            return;
          }
          const time = stats.mtime.toLocaleString(locale);
          if (name === "startup.json") {
            choices.push({
              id: "startup",
              text: t("Last successful startup ({{time}})", {
                replace: { time },
              }),
              value: false,
            });
          } else if (name === "hourly.json") {
            choices.push({
              id: "hourly",
              text: t("Last hourly backup ({{time}})", { replace: { time } }),
              value: false,
            });
          } else if (name === "manual.json") {
            choices.push({
              id: "manual",
              text: t("Last manual backup ({{time}})", { replace: { time } }),
              value: false,
            });
          }
        }),
      );
      const choice = await onShowDialog(
        "question",
        "Select backup",
        {
          text: "Please select the backup to restore",
          choices,
        },
        [{ label: "Cancel", default: true }, { label: "Restore" }],
      );
      if (choice.action !== "Restore") {
        return;
      }

      const selected = Object.keys(choice.input).find(
        (key) => choice.input[key] === true,
      );
      const paragraph = (text: string) => `${text}<br/><br/>`;

      let filePath: string;

      if (selected === "from_file") {
        filePath = await this.context.api.selectFile({
          create: false,
          filters: [{ extensions: ["json"], name: "State backup" }],
          title: "Select file location",
        });
      } else if (selected !== undefined) {
        filePath = path.join(basePath, selected + ".json");
      }
      if (filePath !== undefined) {
        const fileName = path.basename(filePath);
        const stats: fs.Stats = await fs.statAsync(filePath);
        const confirm = await onShowDialog(
          "question",
          "Confirm",
          {
            bbcode:
              paragraph(
                "This will reset Vortex settings and persistent data " +
                  "to a state from {{time}}.",
              ) +
              paragraph(
                "Are you sure you want to proceed? Note that this option is not meant " +
                  "to be used lightly or in a haphazard attempt to fix an issue.",
              ) +
              paragraph(
                "This will not: [list]" +
                  "[*]Restore or delete mods/files on disk" +
                  "[*]Undo deployments" +
                  "[/list]",
              ) +
              paragraph(
                "DO NOT CONTINUE if you have changed the download folder or the " +
                  "mod staging folder for ANY game.",
              ) +
              paragraph(
                "ONLY proceed if you have been instructed by Nexus Mods staff, are " +
                  "following official documentation, or are absolutely certain that you " +
                  "know what you are doing.",
              ),
            parameters: {
              time: relativeTime(stats.mtime, t),
            },
          },
          [{ label: "Cancel", default: true }, { label: "Confirm" }],
        );
        if (confirm.action === "Confirm") {
          spawnSelf(["--restore", filePath]);
          getApplication().quit();
        }
      }
    } catch (err) {
      const code = getErrorCode(err);
      log("error", "failed to list state backups");
      await onShowDialog(
        "error",
        "There are no backups to restore",
        {
          text: "Found no backup to restore",
          message:
            code === "ENOENT" ? undefined : getErrorMessageOrDefault(err),
        },
        [{ label: "Close" }],
      );
    }
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onShowDialog: (
      type: DialogType,
      title: string,
      content: IDialogContent,
      actions: DialogActions,
    ) => dispatch(showDialog(type, title, content, actions)),
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(Settings) as any,
) as React.ComponentClass<{}>;
