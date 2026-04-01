import * as React from "react";
import { Checkbox, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";

import { ComponentEx } from "../../controls/ComponentEx";
import { Icon, LoadOrderIndexInput, tooltip } from "../../controls/api";
import type {
  IExtensionApi,
  ILoadOrderEntry,
  IState,
  LoadOrder,
} from "../../types/api";
import * as selectors from "../../util/selectors";
import {
  setFBLoadOrder,
  setFBLoadOrderEntry,
} from "../file_based_loadorder/actions/loadOrder";
import { currentLoadOrderForProfile } from "../file_based_loadorder/selectors";

import {
  formatCyberpunkBucket,
  getCyberpunkArchivePath,
  getCyberpunkBucket,
  openCyberpunkArchiveInspector,
  type ICyberpunkLoadOrderData,
} from "./common";

interface IConnectedProps {
  loadOrder: LoadOrder;
  profileId: string;
}

interface IActionProps {
  onSetLoadOrderEntry: (profileId: string, entry: ILoadOrderEntry) => void;
  onSetLoadOrder: (profileId: string, loadOrder: LoadOrder) => void;
}

interface IBaseProps {
  className?: string;
  item: {
    loEntry: ILoadOrderEntry<ICyberpunkLoadOrderData>;
    displayCheckboxes: boolean;
    invalidEntries?: { id: string; reason: string }[];
    setRef?: (ref: any) => void;
  };
  forwardedRef?: (ref: any) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class CyberpunkLoadOrderItem extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const item = this.props.item.loEntry;
    const displayCheckboxes = this.props.item.displayCheckboxes ?? false;
    return this.renderDraggable(item, displayCheckboxes);
  }

  private renderDraggable(
    item: ILoadOrderEntry<ICyberpunkLoadOrderData>,
    displayCheckboxes: boolean,
  ): JSX.Element {
    const { className, loadOrder } = this.props;
    const key = item.name ?? item.id;
    const bucket = getCyberpunkBucket(item);
    const archivePath = getCyberpunkArchivePath(item);

    let classes = ["load-order-entry", "cyberpunk-load-order-entry"];
    if (className !== undefined) {
      classes = classes.concat(className.split(" "));
    }

    const bucketClass =
      bucket === "redmod"
        ? "cyberpunk-load-order-bucket redmod"
        : "cyberpunk-load-order-bucket archive";

    const checkBox = () =>
      displayCheckboxes ? (
        <Checkbox
          className="entry-checkbox"
          checked={item.enabled}
          disabled={this.isLocked(item)}
          onChange={this.onStatusChange}
        />
      ) : null;

    const lock = () =>
      this.isLocked(item) ? (
        <Icon className="locked-entry-logo" name="locked" />
      ) : null;

    return (
      <ListGroupItem
        key={key}
        className={classes.join(" ")}
        ref={this.props.item.setRef ?? this.props.forwardedRef}
      >
        <Icon className="drag-handle-icon" name="drag-handle" />
        <LoadOrderIndexInput
          className="load-order-index"
          api={this.context.api as IExtensionApi}
          item={item as ILoadOrderEntry}
          currentPosition={this.currentPosition()}
          lockedEntriesCount={this.lockedEntriesCount()}
          loadOrder={loadOrder}
          isLocked={this.isLocked}
          onApplyIndex={this.onApplyIndex}
        />
        {this.renderValidationError()}
        <p className="load-order-name">
          <span style={{ marginRight: "8px" }}>{key}</span>
          <span className={bucketClass}>{formatCyberpunkBucket(bucket)}</span>
        </p>
        <div className="cyberpunk-load-order-meta">
          {archivePath ? (
            <span className="cyberpunk-load-order-path">{archivePath}</span>
          ) : null}
          {archivePath ? (
            <button
              type="button"
              className="btn btn-link btn-xs"
              onClick={this.onInspectArchive}
            >
              Inspect
            </button>
          ) : null}
        </div>
        {this.renderExternalBanner(item)}
        {checkBox()}
        {lock()}
      </ListGroupItem>
    );
  }

  private renderValidationError(): JSX.Element {
    const { invalidEntries } = this.props.item;
    const invalidEntry =
      invalidEntries !== undefined
        ? invalidEntries.find(
            (inv) => inv.id.toLowerCase() === this.props.item.loEntry.id.toLowerCase(),
          )
        : undefined;
    return invalidEntry !== undefined ? (
      <tooltip.Icon
        className="fblo-invalid-entry"
        name="feedback-error"
        tooltip={invalidEntry.reason}
      />
    ) : null;
  }

  private renderExternalBanner(item: ILoadOrderEntry): JSX.Element {
    const { t } = this.props;
    return this.isExternal(item) ? (
      <div className="load-order-unmanaged-banner">
        <Icon className="external-caution-logo" name="feedback-warning" />
        <span className="external-text-area">{t("Not managed by Vortex")}</span>
      </div>
    ) : null;
  }

  private isLocked(item: ILoadOrderEntry): boolean {
    return [true, "true", "always"].includes(item.locked as any);
  }

  private isExternal(item: ILoadOrderEntry): boolean {
    return item.modId === undefined;
  }

  private onStatusChange = (evt: any) => {
    const { item, onSetLoadOrderEntry, profileId } = this.props;
    const entry = {
      ...item.loEntry,
      enabled: evt.target.checked,
    };
    onSetLoadOrderEntry(profileId, entry);
  };

  private currentPosition = (): number =>
    this.props.loadOrder.findIndex(
      (entry) => entry.id === this.props.item.loEntry.id,
    ) + 1;

  private onApplyIndex = (idx: number) => {
    const { item, onSetLoadOrder, profileId, loadOrder } = this.props;
    const currentIdx = this.currentPosition();
    if (currentIdx === idx) {
      return;
    }

    const entry = {
      ...item.loEntry,
      index: idx,
    };

    const newLO = loadOrder.filter((entry) => entry.id !== item.loEntry.id);
    newLO.splice(idx - 1, 0, entry);
    onSetLoadOrder(profileId, newLO);
  };

  private lockedEntriesCount = (): number =>
    this.props.loadOrder.filter((item) => this.isLocked(item)).length;

  private onInspectArchive = () => {
    openCyberpunkArchiveInspector(
      this.context.api as IExtensionApi,
      getCyberpunkArchivePath(this.props.item.loEntry),
    );
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  return {
    profileId: profile?.id ?? "",
    loadOrder: profile?.id ? currentLoadOrderForProfile(state, profile.id) : [],
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onSetLoadOrderEntry: (profileId, entry) =>
      dispatch(setFBLoadOrderEntry(profileId, entry)),
    onSetLoadOrder: (profileId, loadOrder) =>
      dispatch(setFBLoadOrder(profileId, loadOrder)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  CyberpunkLoadOrderItem as any,
) as unknown as React.ComponentClass<{
  className?: string;
  item: {
    loEntry: ILoadOrderEntry<ICyberpunkLoadOrderData>;
    displayCheckboxes: boolean;
    invalidEntries?: { id: string; reason: string }[];
    setRef?: (ref: any) => void;
  };
  forwardedRef?: (ref: any) => void;
}>;
