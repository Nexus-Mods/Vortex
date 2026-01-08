import * as React from "react";
import { ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import { Toggle } from "../../..";
import {
  ComponentEx,
  connect,
  translate,
} from "../../../renderer/controls/ComponentEx";
import { setAnalytics } from "../actions/analytics.action";
import { HELP_ARTICLE, PRIVACY_POLICY } from "../constants";

interface IConnectedProps {
  analytics: boolean;
  userInfo: any;
}

interface IActionProps {
  onSetAnalytics: (analytics: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

class SettingsAnalytics extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, analytics, userInfo } = this.props;
    return (
      <form>
        <FormGroup controlId="analytics">
          <ControlLabel>{t("Data & Privacy")}</ControlLabel>
          <Toggle
            checked={analytics}
            onToggle={this.toggleAnalytics}
            disabled={!userInfo}
          >
            {t(
              "Allow this app to collect usage data to improve your experience",
            )}
          </Toggle>
          <HelpBlock>
            {t(
              "Help us provide you with the best modding experience. With your permission, we will collect analytics information and send it to our team to help us improve quality and performance. This information is sent anonymously and will never be shared with a 3rd party.",
            )}
            <br />
            <br />
            <a style={{ marginLeft: "0.25rem" }} href={HELP_ARTICLE}>
              {t("More about the data we track")}
            </a>{" "}
            |{" "}
            <a style={{ marginLeft: "0.25rem" }} href={PRIVACY_POLICY}>
              {t("Privacy Policy")}
            </a>
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggleAnalytics = () => {
    this.props.onSetAnalytics(!this.props.analytics);
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    analytics: state.settings.analytics.enabled,
    userInfo: state.persistent.nexus.userInfo,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onSetAnalytics: (analytics: boolean): void => {
      dispatch(setAnalytics(analytics));
    },
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(SettingsAnalytics),
) as React.ComponentClass<{}>;
