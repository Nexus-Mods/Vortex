import * as React from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { Spinner, tooltip, util } from "vortex-api";
import { NAMESPACE } from "../statics";

interface IBaseProps {
  t: ReactI18Next.TranslationFunction;
}

interface IConnectedProps {
  working: boolean;
}

type IProps = IBaseProps & IConnectedProps;

const ProgressFooter = (props: IProps) => {
  const { t, working } = props;

  return working ? (
    <div style={{ display: "inline", marginLeft: 5, marginRight: 5 }}>
      <tooltip.Icon
        id="update-file-conflicts"
        name="conflict"
        tooltip={t("Updating file conflicts")}
      />
      <Spinner />
    </div>
  ) : null;
};

function mapStateToProps(state: any): IConnectedProps {
  return {
    working:
      util.getSafe(state, ["session", "base", "activity", "mods"], []).length >
      0,
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps)(ProgressFooter) as any,
) as React.ComponentClass<{}>;
