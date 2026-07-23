import React, { useCallback, useRef, type FC } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setSettingsPage } from "@/actions/session";
import EmptyPlaceholder from "@/controls/EmptyPlaceholder";
import { useExtensionObjects } from "@/ExtensionProvider";
import type { IBaseProps } from "@/extensions/settings_interface/SettingsInterface";
import type { PropsCallbackTyped } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import makeReactive from "@/util/makeReactive";
import startupSettings from "@/util/startupSettings";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

interface ISettingsPage {
  title: string;
  component: React.ComponentType<IBaseProps>;
  props: PropsCallbackTyped<IBaseProps>;
  visible: () => boolean;
  priority: number;
}

interface ICombinedSettingsPage {
  priority: number;
  title: string;
  elements: ISettingsPage[];
}

const registerSettings = (
  _instanceGroup: undefined,
  title: string,
  component: React.ComponentType<IBaseProps>,
  props: PropsCallbackTyped<IBaseProps>,
  visible: () => boolean,
  priority?: number,
): ISettingsPage => {
  return { title, component, props, visible, priority: priority || 100 };
};

export const GameSettings: FC<{ active?: boolean; pageId?: string }> = ({ active, pageId }) => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();

  // Get extension objects using the hook instead of HOC
  const settingsPages = useExtensionObjects<ISettingsPage>(registerSettings);

  const settingsPage = useSelector((state: IState) => state.session.base.settingsPage || undefined);

  const startupSettingsRef = useRef(makeReactive(startupSettings));

  const changeStartup = useCallback((key: string, value: unknown) => {
    startupSettingsRef.current[key] = value;
  }, []);

  const sortByPriority = (lhs: ICombinedSettingsPage, rhs: ICombinedSettingsPage) => {
    return lhs.priority - rhs.priority;
  };

  const renderTabElement = (page: ISettingsPage, idx: number): JSX.Element => {
    const props = page.props ? page.props() : {};
    return (
      <div key={idx}>
        {idx !== 0 ? <hr className="my-6 border-stroke-weak" /> : null}

        <page.component
          {...props}
          changeStartup={changeStartup}
          startup={startupSettingsRef.current}
        />
      </div>
    );
  };

  // Check if a setting is per-game (has a visibility condition and is currently visible)
  const isPerGameSetting = (ele: ISettingsPage): boolean =>
    ele.visible !== undefined && ele.visible();

  const renderTabPanel = (page: ICombinedSettingsPage): JSX.Element => {
    // Only show per-game settings (has visibility condition AND currently visible)
    const elements = page.elements
      .filter(isPerGameSetting)
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    return elements.length > 0 ? (
      <div>{elements.map(renderTabElement)}</div>
    ) : (
      <EmptyPlaceholder
        fill={true}
        icon="settings"
        subtext={t("This game has no specific settings in this category.")}
        text={t("Nothing to configure.")}
      />
    );
  };

  // Filter out tabs that have no per-game settings for the current game
  const tabsWithPerGameSettings = (tabs: ICombinedSettingsPage[]) =>
    tabs.filter((tab) => tab.elements.some(isPerGameSetting));

  // Combine all settings by title
  const combined = settingsPages.reduce((prev: ICombinedSettingsPage[], current: ISettingsPage) => {
    const result = prev.slice();
    const existingPage = prev.find((ele: ICombinedSettingsPage) => ele.title === current.title);
    if (existingPage === undefined) {
      result.push({
        title: current.title,
        elements: [current],
        priority: current.priority,
      });
    } else {
      existingPage.elements.push(current);
      if (existingPage.priority === undefined || current.priority < existingPage.priority) {
        existingPage.priority = current.priority;
      }
    }
    return result;
  }, []);

  // Only show tabs that have at least one per-game setting for the current game
  const visibleTabs = tabsWithPerGameSettings(combined).sort(sortByPriority);

  // The active tab is persisted by its untranslated title (shared with the Settings
  // page), so that stays the tab identity (panelId); the label shown is translated.
  const page =
    visibleTabs.find((iter) => iter.title === settingsPage) !== undefined
      ? settingsPage
      : visibleTabs[0]?.title;

  const setCurrentPage = useCallback(
    (panelId: string) => {
      dispatch(setSettingsPage(panelId));
    },
    [dispatch],
  );

  return (
    <Page active={active} pageId={pageId} scrollable={false}>
      <PageHeader
        pictogramName="preferences"
        subtitle={t("Settings specific to the game you are managing.")}
        title={t("Preferences")}
      />

      <PageScroll className="space-y-6 p-6">
        {visibleTabs.length === 0 ? (
          <EmptyPlaceholder
            fill={true}
            icon="settings"
            subtext={t("No game-specific settings available.")}
            text={t("Nothing to configure.")}
          />
        ) : (
          <TabProvider tab={page ?? ""} tabListId="game-settings" onSetSelectedTab={setCurrentPage}>
            <TabBar>
              {visibleTabs.map((tabPage) => (
                <TabButton key={tabPage.title} name={t(tabPage.title)} panelId={tabPage.title} />
              ))}
            </TabBar>

            {visibleTabs.map((tabPage) => (
              <TabPanel id={tabPage.title} key={tabPage.title}>
                {renderTabPanel(tabPage)}
              </TabPanel>
            ))}
          </TabProvider>
        )}
      </PageScroll>
    </Page>
  );
};

export default GameSettings;
