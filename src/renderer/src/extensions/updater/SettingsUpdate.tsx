import type { UpdaterSnapshot } from "@vortex/shared/ipc";
import * as React from "react";
import { FormGroup } from "react-bootstrap";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import { ComponentEx, connect, translate } from "../../controls/ComponentEx";
import More from "../../controls/More";
import type { UpdateChannel, IState } from "../../types/IState";
import { UPDATE_CHANNELS } from "../../types/IState";
import type { VortexInstallType } from "../../types/VortexInstallType";
import { Button } from "../../ui/components/button/Button";
import { Picker } from "../../ui/components/picker/Picker";
import { Typography } from "../../ui/components/typography/Typography";
import Debouncer from "../../util/Debouncer";
import { log } from "../../util/log";
import { setUpdateChannel } from "./actions";
import { getUpdaterStatus } from "./updaterStatus";

interface IConnectedProps {
  updateChannel: UpdateChannel;
  installType: VortexInstallType;
}

interface IActionProps {
  onSetUpdateChannel: (channel: UpdateChannel) => void;
}

interface ISettingsUpdateState {
  checkUpdateButtonDisabled: boolean;
  // what the updater is doing right now, if anything; the button waits it out
  busy: "checking" | "downloading" | null;
}

type IProps = IActionProps & IConnectedProps;

const CHECK_UPDATE_INTERVAL = 60000;
class SettingsUpdate extends ComponentEx<IProps, ISettingsUpdateState> {
  //static contextType = MainContext

  private unsubscribeStatus: (() => void) | undefined;

  constructor(props) {
    super(props);

    this.initState({
      checkUpdateButtonDisabled: false,
      busy: null,
    });
  }

  public componentDidMount(): void {
    // a pressed button gives feedback for as long as the work runs: the
    // label reflects the updater's actual state (read from the extension's
    // status poller), not a blind timer
    const poller = getUpdaterStatus();
    const busyFor = (snapshot: UpdaterSnapshot | undefined): ISettingsUpdateState["busy"] =>
      snapshot?.state.type === "checking" || snapshot?.state.type === "downloading"
        ? snapshot.state.type
        : null;
    this.nextState.busy = busyFor(poller?.current());
    this.unsubscribeStatus = poller?.subscribe((snapshot) => {
      this.nextState.busy = busyFor(snapshot);
    });
  }

  public componentWillUnmount(): void {
    this.unsubscribeStatus?.();
  }

  private checkUpdateDebouncer = new Debouncer(
    () => {
      this.checkNow();

      setTimeout(() => {
        this.nextState.checkUpdateButtonDisabled = false;
      }, CHECK_UPDATE_INTERVAL);

      return null;
    },
    CHECK_UPDATE_INTERVAL,
    true,
    true,
  );

  private manualUpdateCheck = () => {
    this.nextState.checkUpdateButtonDisabled = true;
    log("info", "manual update check");
    this.checkUpdateDebouncer.schedule();
  };

  private renderCallout(text: string, brand: "info" | "warning" = "info"): JSX.Element {
    const bg = brand === "warning" ? "bg-warning-950" : "bg-info-950";
    const border = brand === "warning" ? "border-warning-weak" : "border-info-weak";
    return (
      <div className={`rounded-lg border ${border} ${bg} p-3`}>
        <Typography brand="neutral-translucent">{text}</Typography>
      </div>
    );
  }

  public render(): JSX.Element {
    const { t, installType, updateChannel } = this.props;

    const { checkUpdateButtonDisabled, busy } = this.state;

    // managed or development
    if (installType === "managed") {
      // managed and not development
      if (process.env.NODE_ENV !== "development") {
        return this.renderCallout(
          t(
            "Vortex was installed through a third-party service which will take care of updating it.",
          ),
        );
      }

      // managed and development
    }

    // regular
    return (
      <form>
        <FormGroup controlId="updateChannel">
          <div className="flex flex-col items-start gap-y-2">
            {process.env.NODE_ENV === "development"
              ? this.renderCallout(
                  t(
                    "Vortex is running in development mode. Updates will be checked and downloaded but can't be installed.",
                  ),
                )
              : null}

            <Typography as="span">
              {t("Update")}

              <More id="more-update-channel" name={t("Update Channel")}>
                {t(
                  "You can choose to either receive automatic updates only after they went through some " +
                    "community testing (Stable) or to always get the newest features (Beta). Manual checking for updates is " +
                    "restricted to once per minute.",
                )}
              </More>
            </Typography>

            <div className="flex items-center gap-x-2">
              <Picker<UpdateChannel>
                options={[
                  { label: t("Stable"), value: "stable" },
                  { label: t("Beta"), value: "beta" },
                  { label: t("No automatic updates"), value: "none" },
                ]}
                placement="left"
                value={updateChannel}
                onChange={this.selectChannel}
              />

              <Button
                brand="neutral"
                disabled={checkUpdateButtonDisabled || busy !== null}
                onClick={this.manualUpdateCheck}
              >
                {busy === "checking"
                  ? t("Checking...")
                  : busy === "downloading"
                    ? t("Downloading...")
                    : t("Check now")}
              </Button>
            </div>

            {updateChannel === "next"
              ? this.renderCallout(
                  t(
                    "Vortex is running in preview mode and using the hidden 'next' update channel.",
                  ),
                )
              : null}

            {updateChannel === "none"
              ? this.renderCallout(
                  t(
                    "Very old versions of Vortex will be locked out of network features eventually " +
                      "so please do keep Vortex up-to-date.",
                  ),
                  "warning",
                )
              : null}
          </div>
        </FormGroup>
      </form>
    );
  }

  private checkNow = () => {
    // send what updateChannel you are on, unless it's none, then send stable. manual check as well
    const channel = this.props.updateChannel === "none" ? "stable" : this.props.updateChannel;
    window.api.updater.checkForUpdates(channel, true);
    getUpdaterStatus()?.wake();
  };

  private selectChannel = (value: UpdateChannel) => {
    if (UPDATE_CHANNELS.includes(value)) {
      const newChannel = value;

      if (newChannel === "beta") {
        this.context.api.showDialog(
          "question",
          "Switching to Beta update channel",
          {
            text: `Development versions of Vortex can be unstable and cause irreparable damage to your modding environment. 

We recommend using the Beta channel only if you are comfortable with the risks and are willing to report any issues you encounter. We don't recommend downgrading back from beta to stable.

Are you sure you want to switch to the Beta update channel?`,
          },
          [
            { label: "Cancel" },
            {
              label: "Switch to Beta",
              action: () => this.props.onSetUpdateChannel(newChannel),
            },
          ],
        );
      } else if (newChannel === "stable") {
        this.props.onSetUpdateChannel(newChannel);
        // Switching to stable from a pre-release build means the latest
        // stable may be older than what's running; the updater will offer
        // that downgrade separately and explicitly.
      } else if (newChannel === "none") {
        // none

        this.context.api.showDialog(
          "question",
          "Turning off updates",
          {
            text: `This will stop notifications about Vortex updates.

This is not recommended as important security and stability updates are released regularly.

Are you sure you want to turn off updates?`,
          },
          [
            { label: "Cancel" },
            {
              label: "Turn off updates",
              action: () => this.props.onSetUpdateChannel(newChannel),
            },
          ],
        );
      }
    } else {
      log("error", "invalid channel", value);
    }
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    updateChannel: state.settings.update.channel,
    installType: state.app.installType,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetUpdateChannel: (channel: UpdateChannel): void => {
      dispatch(setUpdateChannel(channel));
    },
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(SettingsUpdate),
) as React.ComponentClass<{}>;
