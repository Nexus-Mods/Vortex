import type { IState } from "../../types/IState";
import { connect } from "../controls/ComponentEx";
import { truthy } from "../../util/util";
import { PageHeaderContext } from "./MainPageContainer";

import * as React from "react";
import { Portal } from "react-overlays";

interface IConnectedProps {
  mainPage: string;
  children?: React.ReactNode;
}

type IProps = IConnectedProps;

function MainPageHeader(props: IProps): React.JSX.Element {
  const { mainPage, children } = props;
  const { headerPortal, page } = React.useContext(PageHeaderContext);

  if (!truthy(headerPortal?.())) {
    return null;
  }
  return mainPage === page ? (
    <Portal container={headerPortal}>
      <div className="mainpage-header">{children}</div>
    </Portal>
  ) : null;
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mainPage: state.session.base.mainPage,
  };
}

export default connect(mapStateToProps)(MainPageHeader) as any;
