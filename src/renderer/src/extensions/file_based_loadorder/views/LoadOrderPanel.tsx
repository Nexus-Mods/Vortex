import { unknownToError } from "@vortex/shared";
import * as React from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";

import { ComponentEx } from "../../../controls/ComponentEx";
import DraggableList from "../../../controls/DraggableList";
import EmptyPlaceholder from "../../../controls/EmptyPlaceholder";
import FlexLayout from "../../../controls/FlexLayout";
import Spinner from "../../../controls/Spinner";
import type { IState } from "../../../types/IState";
import { DNDContainer } from "../../../views/DNDContainer";
import type { IProfile } from "../../profile_management/types/IProfile";
import { applyLoadOrderEdit } from "../handlers";
import { RenderRowsCache } from "../renderRows";
import {
  loadOrderForProfile,
  refreshIdForProfile,
  validationResultForLoadOrder,
} from "../selectors";
import {
  type IItemRendererProps,
  type IRegisteredLoadOrder,
  type IValidationResult,
  type LoadOrder,
  LoadOrderValidationError,
} from "../types/types";
import { isEntryLocked } from "../util";
import FilterBox from "./FilterBox";
import InfoPanel from "./InfoPanel";
import ItemRenderer from "./ItemRenderer";

interface IPanelState {
  loading: boolean;
  validationError: LoadOrderValidationError;
  filterText: string;
  rejectedEdits: number;
}

export interface ILoadOrderPanelProps {
  gameEntry: IRegisteredLoadOrder;
  profile: IProfile;
  // Allow dnd operations?
  disabled: boolean;
  onSetOrder: (profileId: string, loadOrder: LoadOrder, loadOrderId?: string) => void;
  onStartUp: (gameMode: string, loadOrderId?: string) => Promise<LoadOrder>;
  onShowError: (gameId: string, error: Error, loadOrderId?: string) => void;
  validateLoadOrder: (profile: IProfile, newLO: LoadOrder, loadOrderId?: string) => Promise<void>;
}

interface IConnectedProps {
  loadOrder: LoadOrder;
  // Changes when the page is told to read its load orders again.
  refreshId: string;
  validationResult: IValidationResult;
}

type IProps = ILoadOrderPanelProps & IConnectedProps;

// One load order of the active profile: its list, filter, validation state and reads from the game.
class LoadOrderPanel extends ComponentEx<IProps, IPanelState> {
  // Memoizes the per-row props so an unrelated re-render keeps the same row
  //  object identities, preserving the rows' React.memo and avoiding a layout
  //  measure in DraggableList.
  private mRenderRows: RenderRowsCache;
  private mReadRequest = 0;

  constructor(props: IProps) {
    super(props);
    this.initState({
      loading: true,
      validationError: undefined,
      filterText: "",
      rejectedEdits: 0,
    });
    this.mRenderRows = new RenderRowsCache(
      props.gameEntry.loadOrderId,
      props.gameEntry.writesOnUserEdit ? this.applyEdit : undefined,
    );
  }

  public componentDidMount() {
    void this.readFromGame().finally(() => (this.nextState.loading = false));
  }

  public componentDidUpdate(prevProps: IProps) {
    if (
      prevProps.refreshId !== this.props.refreshId ||
      (this.props.gameEntry.writesOnUserEdit && prevProps.profile?.id !== this.props.profile?.id)
    ) {
      void this.readFromGame();
      return;
    }
    const { validationResult, loadOrder } = this.props;
    if (validationResult !== prevProps.validationResult) {
      this.nextState.validationError =
        validationResult === undefined
          ? undefined
          : new LoadOrderValidationError(validationResult, loadOrder);
    }
  }

  public componentWillUnmount() {
    ++this.mReadRequest;
  }

  public render(): JSX.Element {
    const { t, loadOrder, gameEntry } = this.props;
    const { validationError } = this.state;
    const chosenItemRenderer = gameEntry.customItemRenderer ?? ItemRenderer;
    const enabled = this.mRenderRows.build(
      loadOrder,
      validationError?.validationResult?.invalid,
      gameEntry.toggleableEntries || false,
      this.state.filterText,
    );

    const infoPanel = () => (
      <InfoPanel
        conflictWinner={gameEntry.conflictWinner}
        info={gameEntry.usageInstructions}
        validationError={validationError}
      />
    );

    const draggableList = () =>
      this.nextState.loading ? (
        this.renderWait()
      ) : enabled.length > 0 ? (
        <DraggableList
          key={this.state.rejectedEdits}
          apply={this.onApply}
          disabled={this.props.disabled || this.state.filterText !== ""}
          id="mod-loadorder-draggable-list"
          idFunc={this.getItemId}
          isLocked={this.isLocked}
          itemRenderer={chosenItemRenderer}
          items={enabled}
          itemTypeId="file-based-lo-draggable-entry"
          reorderOnDirectHover={gameEntry.reorderOnDirectHover}
          virtualized={
            gameEntry.customItemRenderer === undefined || gameEntry.uniformRowHeight === true
          }
        />
      ) : (
        <EmptyPlaceholder
          fill={true}
          icon="folder-download"
          subtext={t("Please make sure to deploy")}
          text={t("You don't have any orderable entries")}
        />
      );
    const listClasses = this.props.disabled
      ? ["file-based-load-order-list", "disabled"]
      : ["file-based-load-order-list"];
    return (
      <>
        <FilterBox currentFilterValue={this.state.filterText} setFilter={this.onFilter} />

        <DNDContainer style={{ height: "95%" }}>
          <FlexLayout className="file-based-load-order-container" type="row">
            <FlexLayout.Flex className={listClasses.join(" ")}>{draggableList()}</FlexLayout.Flex>

            <FlexLayout.Flex>{infoPanel()}</FlexLayout.Flex>
          </FlexLayout>
        </DNDContainer>
      </>
    );
  }

  private onFilter = (filterText: string) => (this.nextState.filterText = filterText);

  private renderWait() {
    return (
      <div className="fblo-spinner-container">
        <Spinner className="file-based-load-order-spinner" />
      </div>
    );
  }

  private getItemId = (item: IItemRendererProps): string => item.loEntry.id;

  private isLocked = (item: IItemRendererProps): boolean => {
    return item?.loEntry?.locked !== undefined && isEntryLocked(item.loEntry.locked);
  };

  // Reads this load order from the game and shows it, invalid or not, so the user can fix it here.
  private readFromGame = (): Promise<void> => {
    const { gameEntry, onStartUp, onSetOrder, profile } = this.props;
    const request = ++this.mReadRequest;
    return onStartUp(profile?.gameId, gameEntry.loadOrderId)
      .then((lo) => {
        if (gameEntry.writesOnUserEdit && request !== this.mReadRequest) return;
        this.nextState.validationError = undefined;
        if (lo !== undefined) {
          onSetOrder(profile.id, lo, gameEntry.loadOrderId);
        }
      })
      .catch((err) => {
        if (gameEntry.writesOnUserEdit && request !== this.mReadRequest) return;
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err;
          onSetOrder(profile.id, err.loadOrder, gameEntry.loadOrderId);
        }
      });
  };

  private applyEdit = (order: LoadOrder): void => {
    const { gameEntry, profile, onShowError, loadOrder } = this.props;
    void applyLoadOrderEdit(this.context.api, profile.id, gameEntry, order, loadOrder)
      .then(() => (this.nextState.validationError = undefined))
      .catch((err) => {
        this.nextState.rejectedEdits = this.state.rejectedEdits + 1;
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err;
        } else {
          onShowError(profile.gameId, unknownToError(err), gameEntry.loadOrderId);
        }
      });
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
    const { gameEntry, onSetOrder, onShowError, profile, validateLoadOrder } = this.props;
    const newLO = ordered.map((item) => item.loEntry);
    if (gameEntry.writesOnUserEdit) {
      this.applyEdit(newLO);
      return;
    }
    validateLoadOrder(profile, newLO, gameEntry.loadOrderId)
      .then(() => (this.nextState.validationError = undefined))
      .catch((err) => {
        if (err instanceof LoadOrderValidationError) {
          this.nextState.validationError = err;
        } else {
          onShowError(profile.gameId, unknownToError(err), gameEntry.loadOrderId);
        }
      })
      // Regardless of whether the lo is valid or not, we still want it
      //  displayed to the user to give them a chance to fix it from inside
      //  Vortex (if possible)
      .finally(() => onSetOrder(profile.id, newLO, gameEntry.loadOrderId));
  };
}

function mapStateToProps(state: IState, ownProps: ILoadOrderPanelProps): IConnectedProps {
  const { profile, gameEntry } = ownProps;
  return {
    loadOrder: loadOrderForProfile(state, profile?.id, gameEntry.loadOrderId),
    refreshId: refreshIdForProfile(state, profile?.id),
    validationResult: validationResultForLoadOrder(state, profile?.id, gameEntry.loadOrderId),
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps)(LoadOrderPanel) as React.ComponentType,
) as unknown as React.ComponentClass<ILoadOrderPanelProps>;
