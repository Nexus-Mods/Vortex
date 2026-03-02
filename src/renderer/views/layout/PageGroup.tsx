import React, { memo, useMemo, type FC } from "react";
import { Nav } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import type { IMainPage } from "../../types/IMainPage";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { NavItem } from "../../controls/TooltipControls";
import { log } from "../../logging";
import { PageButton } from "../PageButton";

export interface IPageGroupProps {
  title: string | undefined;
  groupKey: string;
  pages: IMainPage[];
  mainPage: string;
  secondaryPage: string;
  tabsMinimized: boolean;
  onClickPage: (pageId: string, ctrlKey: boolean) => void;
}

/**
 * Provides a page group in the sidebar.
 * For Classic layout.
 */
export const PageGroup: FC<IPageGroupProps> = memo((props) => {
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

  const visiblePages = useMemo(() => {
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
        activeKey={mainPage}
        bsStyle="pills"
        className="main-nav-group"
        stacked={true}
      >
        {visiblePages.map((page) => (
          <NavItem
            className={secondaryPage === page.id ? "secondary" : undefined}
            eventKey={page.id}
            id={page.id}
            key={page.id}
            placement="right"
            tooltip={t(page.title, { ns: page.namespace })}
            onClick={(e) => onClickPage(page.id, e.ctrlKey)}
          >
            <PageButton namespace={page.namespace} page={page} />
          </NavItem>
        ))}
      </Nav>
    </div>
  );
});
