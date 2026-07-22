import React from "react";
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
import { getTabId } from "@/ui/utils/getTabId";
import lazyRequire from "@/util/lazyRequire";
import makeReactive from "@/util/makeReactive";
import type startupSettingsT from "@/util/startupSettings";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

const startupSettings = lazyRequire<typeof startupSettingsT>(
  () => require("@/util/startupSettings"),
  "default",
);

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

export const Settings: React.FC<{ active?: boolean; pageId?: string }> = ({ active, pageId }) => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();

  // Get extension objects using the hook instead of HOC
  const allSettingPages = useExtensionObjects<ISettingsPage>(registerSettings);

  const useModernLayout = useSelector((state: IState) => state.settings.window.useModernLayout);

  // In Modern UI, game-specific settings (those with a visible callback) are shown
  // in the dedicated Game Settings page, so exclude them here to avoid duplication.
  const settingPages = useModernLayout
    ? allSettingPages.filter((page) => page.visible === undefined)
    : allSettingPages;

  const settingsPage = useSelector((state: IState) => state.session.base.settingsPage || undefined);

  const startupSettingsRef = React.useRef(makeReactive(startupSettings));

  const changeStartup = React.useCallback((key: string, value: unknown) => {
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

  const renderTabPanel = (page: ICombinedSettingsPage): JSX.Element => {
    // Show both global settings and game-specific settings that are currently visible
    const elements = page.elements
      .filter((ele) => ele.visible === undefined || ele.visible())
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    return elements.length > 0 ? (
      <div>{elements.map(renderTabElement)}</div>
    ) : (
      <EmptyPlaceholder
        icon="settings"
        subtext={t("Other games may require settings here.")}
        text={t("Nothing to configure.")}
      />
    );
  };

  const combined = settingPages.reduce((prev: ICombinedSettingsPage[], current: ISettingsPage) => {
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

  // Filter out tabs that have no visible elements and sort by priority
  const visibleTabs = combined
    .filter((tabPage) => tabPage.elements.some((ele) => ele.visible === undefined || ele.visible()))
    .sort(sortByPriority);

  // The active tab is persisted (and deep-linked into, e.g. from Health Check via
  // setSettingsPage("Vortex")) by its untranslated title, so that stays the tab
  // identity. The new Tabs match on getTabId(name), so drive them with the raw title
  // and map the id the provider hands back to onSetSelectedTab (getTabId(title)) back
  // to the original title before persisting.
  const page =
    visibleTabs.find((iter) => iter.title === settingsPage) !== undefined
      ? settingsPage
      : visibleTabs[0]?.title;

  const setCurrentPage = React.useCallback(
    (tabId: string) => {
      const match = visibleTabs.find((iter) => getTabId(iter.title) === tabId);
      if (match !== undefined) {
        dispatch(setSettingsPage(match.title));
      }
    },
    [dispatch, visibleTabs],
  );

  return (
    <Page active={active} pageId={pageId} scrollable={false}>
      <PageHeader
        pictogramName="settings"
        subtitle={t("Configure Vortex and manage your preferences.")}
        title={t("Settings")}
      />

      <PageScroll className="space-y-6 p-6">
        <TabProvider tab={page ?? ""} tabListId="settings" onSetSelectedTab={setCurrentPage}>
          <TabBar>
            {visibleTabs.map((tabPage) => (
              <TabButton key={tabPage.title} label={t(tabPage.title)} name={tabPage.title} />
            ))}
          </TabBar>

          {visibleTabs.map((tabPage) => (
            <TabPanel key={tabPage.title} name={tabPage.title}>
              {renderTabPanel(tabPage)}
            </TabPanel>
          ))}
        </TabProvider>
      </PageScroll>
    </Page>
  );
};

export default Settings;
