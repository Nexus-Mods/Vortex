import * as React from "react";
import { FormGroup } from "react-bootstrap";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import { setMultiUser } from "../../actions/user";
import { ComponentEx, connect, translate } from "../../controls/ComponentEx";
import More from "../../controls/More";
import type { IState } from "../../types/IState";
import { Button } from "../../ui/components/button/Button";
import { Picker } from "../../ui/components/picker/Picker";
import { Typography } from "../../ui/components/typography/Typography";
import { relaunch } from "../../util/commandLine";
import getText from "./texts";

interface IConnectedProps {
  multiUser: boolean;
}

interface IActionProps {
  onSetMultiUser: (multiUser: boolean) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  oldMultiUser: boolean;
}

class SettingsVortex extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      oldMultiUser: props.multiUser,
    });
  }

  public render(): JSX.Element {
    const { t, multiUser } = this.props;
    const { oldMultiUser } = this.state;

    const restartNoti =
      multiUser === oldMultiUser ? null : (
        <div className="flex items-center gap-x-4 rounded-lg border border-info-weak bg-info-950 p-3">
          <Typography brand="neutral-translucent" className="grow">
            {t("You need to restart Vortex to activate this change")}
          </Typography>

          <Button brand="neutral" size="sm" onClick={this.restart}>
            {t("Restart now")}
          </Button>
        </div>
      );

    return (
      <form>
        <FormGroup controlId="muMode">
          <div className="flex flex-col items-start gap-y-2">
            <Typography as="span" typographyType="body-md">
              {t("Multi-User Mode")}

              <More id="more-multi-user" name={t("Multi-User Mode")}>
                {getText("multi-user", t)}
              </More>
            </Typography>

            <Picker<"on" | "off">
              options={[
                { label: t("Shared"), value: "on" },
                { label: t("Per-User"), value: "off" },
              ]}
              value={multiUser ? "on" : "off"}
              onChange={this.selectMode}
            />

            {restartNoti}
          </div>
        </FormGroup>
      </form>
    );
  }

  private selectMode = (value: "on" | "off") => {
    const { onSetMultiUser } = this.props;
    onSetMultiUser(value === "on");
  };

  private restart = () => {
    relaunch();
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    multiUser: state.user.multiUser,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetMultiUser: (multiUser: boolean) => dispatch(setMultiUser(multiUser)),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(SettingsVortex),
) as React.ComponentClass<{}>;
