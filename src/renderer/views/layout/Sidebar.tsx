import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { getGame } from "../../../extensions/gamemode_management/util/getGame";
import { profileById } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import FlexLayout from "../../controls/FlexLayout";
import Icon from "../../controls/Icon";
import { Button } from "../../controls/TooltipControls";
import { MainFooter } from "../MainFooter";
import { PageGroup } from "./PageGroup";

export interface ISidebarProps {
  objects: IMainPage[];
  settingsPage: IMainPage;
  onClickPage: (pageId: string, ctrlKey: boolean) => void;
  onToggleMenu: () => void;
  onSidebarRef: (ref: HTMLElement | null) => void;
}

export const Sidebar = (props: ISidebarProps): JSX.Element => {
  const { objects, settingsPage, onClickPage, onToggleMenu, onSidebarRef } =
    props;

  const { t } = useTranslation();

  const tabsMinimized = useSelector((state: IState) =>
    getSafe(state, ["settings", "window", "tabsMinimized"], false),
  );
  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const secondaryPage = useSelector(
    (state: IState) => state.session.base.secondaryPage,
  );
  const profile = useSelector((state: IState) =>
    profileById(state, state.settings.profiles.activeProfileId),
  );

  const pageGroups = React.useMemo(() => {
    const game = profile !== undefined ? getGame(profile.gameId) : undefined;
    const gameName = game?.shortName || game?.name || "Mods";

    return [
      { title: undefined, key: "dashboard" },
      { title: "General", key: "global" },
      { title: gameName, key: "per-game" },
      { title: "About", key: "support" },
    ];
  }, [profile]);

  const sbClass = tabsMinimized ? "sidebar-compact" : "sidebar-expanded";

  return (
    <FlexLayout.Fixed className={sbClass} id="main-nav-sidebar">
      <div id="main-nav-container" ref={onSidebarRef}>
        {pageGroups.map(({ title, key }) => {
          const groupPages = objects.filter((page) => page.group === key);
          if (key === "global") {
            groupPages.push(settingsPage);
          }
          return (
            <PageGroup
              groupKey={key}
              key={key}
              mainPage={mainPage}
              pages={groupPages}
              secondaryPage={secondaryPage}
              tabsMinimized={tabsMinimized}
              title={title}
              onClickPage={onClickPage}
            />
          );
        })}
      </div>

      <MainFooter slim={tabsMinimized} />

      <Button
        className="btn-menu-minimize"
        id="btn-minimize-menu"
        tooltip={tabsMinimized ? t("Restore") : t("Minimize")}
        onClick={onToggleMenu}
      >
        <Icon name={tabsMinimized ? "pane-right" : "pane-left"} />
      </Button>
    </FlexLayout.Fixed>
  );
};
