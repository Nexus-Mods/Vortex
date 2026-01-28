import * as React from "react";
import { Portal } from "react-overlays";
import { useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { PageHeaderContext } from "./MainPageContainer";

export interface IProps {
  children?: React.ReactNode;
}

export const MainPageHeader: React.FC<IProps> = ({ children }) => {
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const { headerPortal, page } = React.useContext(PageHeaderContext);

  if (!headerPortal?.()) {
    return null;
  }
  return mainPage === page ? (
    <Portal container={headerPortal}>
      <div className="mainpage-header">{children}</div>
    </Portal>
  ) : null;
};

export default MainPageHeader;
