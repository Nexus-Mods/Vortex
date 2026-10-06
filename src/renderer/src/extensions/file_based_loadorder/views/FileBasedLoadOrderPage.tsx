import * as React from "react";
import { Panel } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import type { Dispatch } from "redux";

import * as actions from "../../../actions";
import { IconBar, ToolbarIcon } from "../../../controls/api";
import { ComponentEx } from "../../../controls/ComponentEx";
import ToolbarDropdown from "../../../controls/ToolbarDropdown";
import type * as types from "../../../types/api";
import { TabBar } from "../../../ui/components/tabs/TabBar";
import { TabButton } from "../../../ui/components/tabs/TabButton";
import { TabPanel } from "../../../ui/components/tabs/TabPanel";
import { TabProvider } from "../../../ui/components/tabs/Tabs.context";
import * as util from "../../../util/api";
import * as selectors from "../../../util/selectors";
import { MainPage } from "../../../views/api";
import { fbLoadOrderTabSelected, setFBForceUpdate } from "../actions/session";
import { activeLoadOrderIdForProfile } from "../selectors";
import type { IRegisteredLoadOrder } from "../types/types";
import LoadOrderPanel, { type ILoadOrderPanelProps } from "./LoadOrderPanel";
import { resolveActiveLoadOrderId } from "./tabs";

export interface IBaseProps extends Pick<
  ILoadOrderPanelProps,
  "onSetOrder" | "onStartUp" | "onShowError" | "validateLoadOrder"
> {
  getGameEntries: (gameId: string) => IRegisteredLoadOrder[];
  onImportList: (loadOrderId?: string) => void;
  onExportList: (loadOrderId?: string) => void;
  onSortByDeployOrder: (profileId: string, loadOrderId?: string) => void;
}

interface IConnectedProps {
  // The profile we're managing this load order for.
  profile: types.IProfile;

  // Does the user need to deploy ?
  needToDeploy: boolean;

  // The load order whose tab the profile has open.
  activeLoadOrderId: string | undefined;

  // Allow dnd operations?
  disabled: boolean;
}

interface IActionProps {
  onSetDeploymentNecessary: (gameId: string, necessary: boolean) => void;
  onForceRefresh: (profileId: string) => void;
  onSelectTab: (profileId: string, loadOrderId: string) => void;
}

type IProps = IActionProps & IBaseProps & IConnectedProps;

// The load order page: one panel per load order the game registers, as tabs when there are several.
class FileBasedLoadOrderPage extends ComponentEx<IProps, Record<string, never>> {
  private mStaticButtons: types.IActionDefinition[];

  constructor(props: IProps) {
    super(props);

    this.mStaticButtons = [
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: "btn-deploy",
            key: "btn-deploy",
            icon: "deploy",
            text: "Deploy Mods",
            className: this.props.needToDeploy ? "toolbar-flash-button" : undefined,
            onClick: async () => {
              await util.toPromise((cb) => this.context.api.events.emit("deploy-mods", cb));
              const gameId = selectors.activeGameId(this.context.api.getState());
              this.props.onSetDeploymentNecessary(gameId, false);
            },
          };
        },
      },
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: "btn-purge-list",
            key: "btn-purge-list",
            icon: "purge",
            text: "Purge Mods",
            className: "load-order-purge-list",
            onClick: async () => {
              await util.toPromise((cb) => this.context.api.events.emit("purge-mods", false, cb));
              const gameId = selectors.activeGameId(this.context.api.getState());
              this.props.onSetDeploymentNecessary(gameId, true);
            },
          };
        },
      },
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: "btn-refresh-list",
            key: "btn-refresh-list",
            icon: "refresh",
            text: "Refresh List",
            className: "load-order-refresh-list",
            onClick: () => this.props.onForceRefresh(this.props.profile.id),
          };
        },
      },
      {
        component: ToolbarDropdown,
        props: () => {
          return {
            t: this.props.t,
            key: "btn-import-export-list",
            id: "btn-import-export-list",
            instanceId: [],
            icons: [
              {
                icon: this.props.disabled ? "spinner" : "import",
                title: "Load Order Import",
                action: () => this.props.onImportList(this.activeLoadOrderId()),
                default: true,
              },
              {
                icon: this.props.disabled ? "spinner" : "import",
                title: "Load Order Export",
                action: () => this.props.onExportList(this.activeLoadOrderId()),
              },
            ],
          };
        },
      },
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: "btn-sort-by-deploy-order",
            key: "btn-sort-by-deploy-order",
            icon: "loot-sort",
            text: "Sort by Deploy Order",
            className: "load-order-sort-deploy-order",
            onClick: () =>
              this.props.onSortByDeployOrder(this.props.profile.id, this.activeLoadOrderId()),
          };
        },
      },
    ];
  }

  public render(): JSX.Element {
    const { t } = this.props;
    return (
      <MainPage>
        <MainPage.Header>
          <IconBar
            className="menubar"
            group="fb-load-order-icons"
            staticElements={this.mStaticButtons}
            t={t}
          />
        </MainPage.Header>

        <MainPage.Body>
          <Panel>
            <Panel.Body>{this.renderLoadOrders()}</Panel.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private gameEntries(): IRegisteredLoadOrder[] {
    const { getGameEntries, profile } = this.props;
    return profile?.gameId !== undefined ? getGameEntries(profile.gameId) : [];
  }

  private activeLoadOrderId(): string | undefined {
    return resolveActiveLoadOrderId(this.gameEntries(), this.props.activeLoadOrderId);
  }

  private renderLoadOrders(): JSX.Element {
    const { t, profile } = this.props;
    const entries = this.gameEntries();
    if (entries.length === 0) {
      return null;
    }
    if (entries.length === 1) {
      return this.renderPanel(entries[0]);
    }
    const tabName = (entry: IRegisteredLoadOrder) =>
      t(entry.displayName ?? (entry.isPrimary ? "Load order" : entry.loadOrderId));
    return (
      <div className="fblo-load-order-tabs">
        <TabProvider
          tab={resolveActiveLoadOrderId(entries, this.props.activeLoadOrderId)}
          tabListId="fblo-load-orders"
          onSetSelectedTab={(loadOrderId) => this.props.onSelectTab(profile.id, loadOrderId)}
        >
          <TabBar>
            {entries.map((entry) => (
              <TabButton
                key={entry.loadOrderId}
                name={tabName(entry)}
                panelId={entry.loadOrderId}
              />
            ))}
          </TabBar>

          {entries.map((entry) => (
            <TabPanel id={entry.loadOrderId} key={entry.loadOrderId}>
              {this.renderPanel(entry)}
            </TabPanel>
          ))}
        </TabProvider>
      </div>
    );
  }

  private renderPanel(gameEntry: IRegisteredLoadOrder): JSX.Element {
    const { profile, disabled, onSetOrder, onStartUp, onShowError, validateLoadOrder } = this.props;
    return (
      <LoadOrderPanel
        disabled={disabled}
        gameEntry={gameEntry}
        key={gameEntry.loadOrderId}
        profile={profile}
        validateLoadOrder={validateLoadOrder}
        onSetOrder={onSetOrder}
        onShowError={onShowError}
        onStartUp={onStartUp}
      />
    );
  }
}

function mapStateToProps(state: types.IState): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  return {
    profile,
    needToDeploy: selectors.needToDeploy(state),
    activeLoadOrderId: activeLoadOrderIdForProfile(state, profile?.id),
    disabled: shouldSuppressUpdate(state),
  };
}

function mapDispatchToProps(dispatch: Dispatch): IActionProps {
  return {
    onSetDeploymentNecessary: (gameId: string, necessary: boolean) => {
      dispatch(actions.setDeploymentNecessary(gameId, necessary));
    },
    onForceRefresh: (profileId: string) => {
      dispatch(setFBForceUpdate(profileId));
    },
    onSelectTab: (profileId: string, loadOrderId: string) => {
      dispatch(fbLoadOrderTabSelected(profileId, loadOrderId));
    },
  };
}

function shouldSuppressUpdate(state: types.IState) {
  const suppressOnActivities = ["deployment", "purging", "installing_dependencies"];
  const isActivityRunning = (activity: string) =>
    util.getSafe(state, ["session", "base", "activity", "mods"], []).includes(activity) || // purge/deploy
    util.getSafe(state, ["session", "base", "activity", activity], []).length > 0; // installing_dependencies
  return suppressOnActivities.some((activity) => isActivityRunning(activity));
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(FileBasedLoadOrderPage) as React.ComponentType,
) as unknown as React.ComponentClass<IBaseProps>;
