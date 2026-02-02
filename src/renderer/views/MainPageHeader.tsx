import React, { type FC, type ReactNode, useContext } from "react";
import { Portal } from "react-overlays";
import { useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { PageHeaderContext } from "./MainPageContainer";

export interface IProps {
  children?: ReactNode;
}

export const MainPageHeader: FC<IProps> = ({ children }) => {
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const { headerPortal, page } = useContext(PageHeaderContext);

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
