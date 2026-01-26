import { NavItem } from "../../controls/TooltipControls";
import type { IMainPage } from "../../../types/IMainPage";
import { log } from "../../../util/log";
import { getErrorMessageOrDefault } from "../../../shared/errors";
import PageButton from "../PageButton";
import * as React from "react";
import { Nav } from "react-bootstrap";
import { useTranslation } from "react-i18next";

export interface IPageGroupProps {
  title: string | undefined;
  groupKey: string;
  pages: IMainPage[];
  mainPage: string;
  secondaryPage: string;
  tabsMinimized: boolean;
  onClickPage: (evt: React.MouseEvent<any>) => void;
}

export const PageGroup: React.FC<IPageGroupProps> = React.memo((props) => {
  const {
    title,
    groupKey,
    pages,
    mainPage,
    secondaryPage,
    tabsMinimized,
    onClickPage,
  } = props;

  const { t } = useTranslation();

  const visiblePages = React.useMemo(() => {
    return pages.filter((page) => {
      try {
        return page.visible();
      } catch (err) {
        log("error", "Failed to determine page visibility", {
          error: getErrorMessageOrDefault(err),
          page: page.id,
        });
        return false;
      }
    });
  }, [pages]);

  if (visiblePages.length === 0) {
    return null;
  }

  const showTitle = !tabsMinimized && title !== undefined;

  return (
    <div key={groupKey}>
      {showTitle ? <p className="main-nav-group-title">{t(title)}</p> : null}
      <Nav
        bsStyle="pills"
        stacked
        activeKey={mainPage}
        className="main-nav-group"
      >
        {visiblePages.map((page) => (
          <NavItem
            id={page.id}
            className={secondaryPage === page.id ? "secondary" : undefined}
            key={page.id}
            eventKey={page.id}
            tooltip={t(page.title, { ns: page.namespace })}
            placement="right"
            onClick={onClickPage}
          >
            <PageButton namespace={page.namespace} page={page} />
          </NavItem>
        ))}
      </Nav>
    </div>
  );
});
