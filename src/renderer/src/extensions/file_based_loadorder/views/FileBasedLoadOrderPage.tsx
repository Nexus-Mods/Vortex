/* eslint-disable */
import * as _ from "lodash";
import * as React from "react";
import { Panel } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";

import * as actions from "../../../actions";
import {
  DraggableList,
  EmptyPlaceholder,
  FlexLayout,
  IconBar,
  Spinner,
  ToolbarIcon,
} from "../../../controls/api";
import * as types from "../../../types/api";
import * as util from "../../../util/api";
import { ComponentEx } from "../../../controls/ComponentEx";
import * as selectors from "../../../util/selectors";
import { DNDContainer, MainPage } from "../../../views/api";
import FilterBox from "./FilterBox";

import {
  type IItemRendererProps,
  type ILoadOrderGameInfo,
  type LoadOrder,
  LoadOrderValidationError,
} from "../types/types";
import InfoPanel from "./InfoPanel";
import ItemRenderer from "./ItemRenderer";
import { setFBForceUpdate } from "../actions/session";
import ToolbarDropdown from "../../../controls/ToolbarDropdown";

import { currentLoadOrderForProfile } from "../selectors";
import { unknownToError } from "@vortex/shared";

const PanelX: any = Panel;

interface IBaseState {
  loading: boolean;
  updating: boolean;
  validationError: LoadOrderValidationError;
  currentRefreshId: string;
  filterText: string;
}

export interface IBaseProps {
  getGameEntry: (gameId: string) => ILoadOrderGameInfo;
  onImportList: () => void;
  onExportList: () => void;
  onSetOrder: (
    profileId: string,
    loadOrder: LoadOrder,
    refresh?: boolean,
  ) => void;
  onSortByDeployOrder: (profileId: string) => void;
  onStartUp: (gameMode: string) => Promise<LoadOrder>;
  onShowError: (gameId: string, error: Error) => void;
  validateLoadOrder: (
    profile: types.IProfile,
    newLO: LoadOrder,
  ) => Promise<void>;
}

interface IConnectedProps {
  // The current loadorder
  loadOrder: LoadOrder;

  // The profile we're managing this load order for.
  profile: types.IProfile;

  // Does the user need to deploy ?
  needToDeploy: boolean;

  // The refresh id for the current profile
  //  (used to force a refresh of the list)
  refreshId: string;

  validationResult: types.IValidationResult;

  // Allow dnd operations?
  disabled: boolean;
}

interface IActionProps {
  onSetDeploymentNecessary: (gameId: string, necessary: boolean) => void;
  onForceRefresh: (profileId: string) => void;
}

type IProps = IActionProps & IBaseProps & IConnectedProps;
type IComponentState = IBaseState;

class FileBasedLoadOrderPage extends ComponentEx<IProps, IComponentState> {
  private mStaticButtons: types.IActionDefinition[];

  constructor(props: IProps) {
    super(props);
    this.initState({
      loading: true,
      updating: false,
      validationError: undefined,
      currentRefreshId: "",
      filterText: "",
    });

    this.mStaticButtons = [
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: "btn-deploy",
            key: "btn-deploy",
            icon: "deploy",
            text: "Deploy Mods",
            className: this.props.needToDeploy
              ? "toolbar-flash-button"
              : undefined,
            onClick: async () => {
              await util.toPromise((cb) =>
                this.context.api.events.emit("deploy-mods", cb),
              );
              const gameId = selectors.activeGameId(
                this.context.api.getState(),
              );
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
              await util.toPromise((cb) =>
                this.context.api.events.emit("purge-mods", false, cb),
              );
              const gameId = selectors.activeGameId(
                this.context.api.getState(),
              );
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
            icon: this.state.updating ? "spinner" : "refresh",
            text: "Refresh List",
            className: "load-order-refresh-list",
            onClick: this.onRefreshList,
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
                icon:
                  this.state.updating || this.props.disabled
                    ? "spinner"
                    : "import",
                title: "Load Order Import",
                action: this.props.onImportList,
                default: true,
              },
              {
                icon:
                  this.state.updating || this.props.disabled
                    ? "spinner"
                    : "import",
                title: "Load Order Export",
                action: this.props.onExportList,
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
            icon: this.state.updating ? "spinner" : "loot-sort",
            text: "Sort by Deploy Order",
            className: "load-order-sort-deploy-order",
            onClick: () =>
              this.state.updating
                ? null
                : this.props.onSortByDeployOrder(this.props.profile.id),
          };
        },
      },
    ];
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    // Zuckerberg isn't going to like this...
    if (
      !!newProps.refreshId &&
      this.state.currentRefreshId !== newProps.refreshId
    ) {
      this.nextState.currentRefreshId = newProps.refreshId;
      this.onRefreshList();
      return;
    }

    if (
      this.state.validationError !== undefined &&
      newProps.validationResult === undefined
    ) {
      this.nextState.validationError = undefined;
      return;
    }

    if (
      this.state.validationError?.validationResult?.invalid !==
      newProps.validationResult?.invalid
    ) {
      this.nextState.validationError = new LoadOrderValidationError(
        newProps.validationResult,
        newProps.loadOrder,
      );
    }
  }

  public componentDidMount() {
    const { onSetOrder, onStartUp, profile } = this.props;
    onStartUp(profile?.gameId)
      .then((lo) => {
        if (lo !== undefined) {
          onSetOrder(profile.id, lo);
        }
      })
      .catch((err) => {
        // The deserialized loadorder failed validation; although invalid
        //  we still want to give the user the ability to modify the LO
        //  to a valid state through the UI rather than force him to do
        //  so manually, which is why we're updating the loadorder state.
        //  Fortunately the lo will fail validation when serialized unless
        //  a valid LO is provided.
        this.nextState.validationError = err as LoadOrderValidationError;
        onSetOrder(profile.id, (err as LoadOrderValidationError).loadOrder);
      })
      .finally(() => (this.nextState.loading = false));
  }

  public componentWillUnmount() {
    this.resetState();
  }

  public render(): JSX.Element {
    const { t, loadOrder, getGameEntry, profile } = this.props;
    const { validationError } = this.state;
    const gameEntry = getGameEntry(profile?.gameId);
    const chosenItemRenderer = gameEntry.customItemRenderer ?? ItemRenderer;
    const enabled =
      gameEntry !== undefined
        ? loadOrder.reduce((accum, loEntry) => {
            const rendOps: IItemRendererProps = {
              loEntry,
              displayCheckboxes: gameEntry.toggleableEntries || false,
              invalidEntries: validationError?.validationResult?.invalid,
            };
            // Filter based on the filterText, matching on loEntry.name or other attributes as needed
            const entryName = loEntry.name ?? loEntry.id;
            if (!entryName) {
              return accum; // Skip entries without a name
            }
            if (
              entryName
                .toLowerCase()
                .includes(this.state.filterText.toLowerCase())
            ) {
              accum.push(rendOps);
            }
            return accum;
          }, [])
        : [];

    const infoPanel = () => (
      <InfoPanel
        validationError={validationError}
        info={gameEntry?.usageInstructions}
      />
    );

    const draggableList = () =>
      this.nextState.loading ? (
        this.renderWait()
      ) : enabled.length > 0 ? (
        <DraggableList
          disabled={
            this.props.disabled ||
            this.state.loading ||
            this.state.filterText !== ""
          }
          itemTypeId="file-based-lo-draggable-entry"
          id="mod-loadorder-draggable-list"
          items={enabled}
          itemRenderer={chosenItemRenderer}
          apply={this.onApply}
          idFunc={this.getItemId}
          isLocked={this.isLocked}
        />
      ) : (
        <EmptyPlaceholder
          icon="folder-download"
          fill={true}
          text={t("You don't have any orderable entries")}
          subtext={t("Please make sure to deploy")}
        />
      );
    const listClasses = this.props.disabled
      ? ["file-based-load-order-list", "disabled"]
      : ["file-based-load-order-list"];
    return (
      <MainPage>
        <MainPage.Header>
          <IconBar
            group="fb-load-order-icons"
            staticElements={this.mStaticButtons}
            className="menubar"
            t={t}
          />
        </MainPage.Header>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <FilterBox
                currentFilterValue={this.state.filterText}
                setFilter={this.onFilter}
              />
              <DNDContainer style={{ height: "95%" }}>
                <FlexLayout
                  type="row"
                  className="file-based-load-order-container"
                >
                  <FlexLayout.Flex className={listClasses.join(" ")}>
                    {draggableList()}
                  </FlexLayout.Flex>
                  <FlexLayout.Flex>{infoPanel()}</FlexLayout.Flex>
                </FlexLayout>
              </DNDContainer>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private resetState() {
    this.nextState.loading = true;
    this.nextState.validationError = undefined;
  }

  private onFilter = (filterText: string) =>
    (this.nextState.filterText = filterText);

  private renderWait() {
    return (
      <div className="fblo-spinner-container">
        <Spinner className="file-based-load-order-spinner" />
      </div>
    );
  }

  private getItemId = (item: IItemRendererProps): string => item.loEntry.id;

  private isLocked = (item: IItemRendererProps): boolean => {
    return [true, "true", "always"].includes(item?.loEntry?.locked);
  };

  private onApply = (ordered: IItemRendererProps[]) => {
    const { t } = this.props;
    if (this.state.filterText !== "") {
      this.context.api.sendNotification({
        type: "warning",
        message: t("Must clear filter to apply changes"),
        allowSuppress: true,
        id: "fblo-filter-not-cleared",
      });
      return;
    }
    const { onSetOrder, onShowError, loadOrder, profile, validateLoadOrder } =
      this.props;
    const newLO = ordered.map((item) => item.loEntry);
    validateLoadOrder(profile, newLO)
      .then(() => (this.nextState.validationError = undefined))
      .catch((err) => {
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err;
        } else {
          onShowError(profile.gameId, unknownToError(err));
        }
      })
      // Regardless of whether the lo is valid or not, we still want it
      //  displayed to the user to give them a chance to fix it from inside
      //  Vortex (if possible)
      .finally(() => onSetOrder(profile.id, newLO));
  };

  private onRefreshList = () => {
    const { onStartUp, onSetOrder, profile } = this.props;
    this.nextState.updating = true;
    onStartUp(profile?.gameId)
      .then((lo) => {
        this.nextState.validationError = undefined;
        onSetOrder(profile.id, lo, true);
      })
      .catch((err) => {
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err as LoadOrderValidationError;
          onSetOrder(profile.id, err.loadOrder, true);
        }
      })
      .finally(() => (this.nextState.updating = false));
  };
}

function mapStateToProps(
  state: types.IState,
  ownProps: IProps,
): IConnectedProps {
  const profile = selectors.activeProfile(state) || undefined;
  let loadOrder = profile?.id
    ? currentLoadOrderForProfile(state, profile.id)
    : [];
  return {
    loadOrder,
    profile,
    needToDeploy: selectors.needToDeploy(state),
    refreshId: util.getSafe(
      state,
      ["session", "fblo", "refresh", profile?.id],
      "",
    ),
    validationResult: util.getSafe(
      state,
      ["session", "fblo", "validationResult", profile?.id],
      undefined,
    ),
    disabled: shouldSuppressUpdate(state),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetDeploymentNecessary: (gameId: string, necessary: boolean) =>
      dispatch(actions.setDeploymentNecessary(gameId, necessary)),
    onForceRefresh: (profileId: string) => {
      dispatch(setFBForceUpdate(profileId));
    },
  };
}

function shouldSuppressUpdate(state: types.IState) {
  const suppressOnActivities = [
    "deployment",
    "purging",
    "installing_dependencies",
  ];
  const isActivityRunning = (activity: string) =>
    util
      .getSafe(state, ["session", "base", "activity", "mods"], [])
      .includes(activity) || // purge/deploy
    util.getSafe(state, ["session", "base", "activity", activity], []).length >
      0; // installing_dependencies
  return suppressOnActivities.some((activity) => isActivityRunning(activity));
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(FileBasedLoadOrderPage) as any,
) as React.ComponentClass<{}>;
