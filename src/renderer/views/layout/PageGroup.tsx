import { NavItem } from "../../controls/TooltipControls";
import type { IMainPage } from "../../../types/IMainPage";
import type { TFunction } from "../../../util/i18n";
import { log } from "../../../util/log";
import { getErrorMessageOrDefault } from "../../../shared/errors";
import PageButton from "../PageButton";
import * as React from "react";
import { Nav } from "react-bootstrap";

export interface IPageGroupProps {
  t: TFunction;
  title: string | undefined;
  groupKey: string;
  pages: IMainPage[];
  mainPage: string;
  secondaryPage: string;
  tabsMinimized: boolean;
  onClickPage: (evt: React.MouseEvent<any>) => void;
}

const PageGroup: React.FC<IPageGroupProps> = React.memo(
  function PageGroup(props) {
    const {
      t,
      title,
      groupKey,
      pages,
      mainPage,
      secondaryPage,
      tabsMinimized,
      onClickPage,
    } = props;

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
              <PageButton t={t} namespace={page.namespace} page={page} />
            </NavItem>
          ))}
        </Nav>
      </div>
    );
  },
);

export default PageGroup;
