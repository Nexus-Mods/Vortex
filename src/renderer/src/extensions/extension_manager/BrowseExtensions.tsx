import { getErrorMessageOrDefault } from "@vortex/shared";
import * as React from "react";
import { Button, FormControl, ListGroup, ListGroupItem, ModalHeader } from "react-bootstrap";

import { log } from "@/logging";

import bbcode from "../../controls/bbcode";
import { ComponentEx, connect, translate } from "../../controls/ComponentEx";
import FlexLayout from "../../controls/FlexLayout";
import FormInput from "../../controls/FormInput";
import Icon from "../../controls/Icon";
import Modal from "../../controls/Modal";
import Spinner from "../../controls/Spinner";
import { IconButton } from "../../controls/TooltipControls";
import ZoomableImage from "../../controls/ZoomableImage";
import type { IAvailableExtension, ISelector } from "../../types/extensions";
import type { IExtensionState, IState } from "../../types/IState";
import opn from "../../util/opn";
import { SITE_ID } from "../gamemode_management/constants";
import { NEXUS_BASE_URL } from "../nexus_integration/constants";
import { findInCatalog, findInstalled } from "./queries";
import { downloadAndInstallExtension, selectorMatch } from "./util";

const NEXUS_MODS_URL: string = `${NEXUS_BASE_URL}/site/mods/`;

export interface IBrowseExtensionsProps {
  visible: boolean;
  onHide: () => void;
  localState: {
    reloadNecessary: boolean;
    preselectModId: number;
  };
  updateExtensions: () => Promise<void>;
  onRefreshExtensions: () => void;
}

type SortOrder = "name" | "recent";

/** Description texts fetched on selection; the extensions endpoint carries none. */
interface IModDescription {
  summary?: string;
  description?: string;
}

interface IBrowseExtensionsState {
  selected?: ISelector;
  installing: string[];
  searchTerm: string;
  sort: SortOrder;
  // keyed by mod ID
  descriptions: Record<number, IModDescription>;
}

function makeSelectorId(ext: IAvailableExtension): string {
  return `${ext.modId}`;
}

interface IConnectedProps {
  availableExtensions: IAvailableExtension[];
  extensions: { [extId: string]: IExtensionState };
  updateTime: number;
  language: string;
}

type IProps = IBrowseExtensionsProps & IConnectedProps;

function nop() {
  // nop
}

class BrowseExtensions extends ComponentEx<IProps, IBrowseExtensionsState> {
  private mModalRef: React.RefObject<any>;
  constructor(props: IProps) {
    super(props);

    this.initState({
      selected: undefined,
      installing: [],
      searchTerm: "",
      sort: "name",
      descriptions: {},
    });

    this.mModalRef = React.createRef();
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (
      nextProps.localState.preselectModId !== this.props.localState.preselectModId &&
      nextProps.localState.preselectModId !== undefined
    ) {
      this.nextState.selected = {
        modId: nextProps.localState.preselectModId,
      };
      this.fetchDescription(nextProps.localState.preselectModId);
    }
  }

  public render() {
    const { t, availableExtensions, language, onHide, onRefreshExtensions, updateTime, visible } =
      this.props;
    const { searchTerm, selected, sort } = this.state;

    const ext =
      selected === undefined
        ? null
        : availableExtensions.find((iter) => selectorMatch(iter, selected));

    const updatedAt = new Date(updateTime);

    return (
      <Modal id="browse-extensions-dialog" show={visible} onHide={nop} ref={this.mModalRef}>
        <ModalHeader>
          <h3>{t("Browse Extensions")}</h3>
        </ModalHeader>
        <Modal.Body>
          <FlexLayout type="row">
            <FlexLayout.Fixed className="extension-list">
              <FlexLayout type="column">
                <FlexLayout.Fixed>
                  <FormInput
                    id="browse-extensions-search"
                    label={t("Search")}
                    placeholder={t("Search")}
                    value={searchTerm}
                    onChange={this.changeSearch}
                    debounceTimer={200}
                  />
                </FlexLayout.Fixed>
                <FlexLayout.Fixed>
                  <FlexLayout type="row" className="extension-sort-container">
                    <FlexLayout.Fixed>{t("Sort by")}</FlexLayout.Fixed>
                    <FlexLayout.Flex>
                      <FormControl componentClass="select" onChange={this.changeSort} value={sort}>
                        <option key={"name"} value={"name"}>
                          {t("Name")}
                        </option>
                        <option key="recent" value="recent">
                          {t("Last update")}
                        </option>
                      </FormControl>
                    </FlexLayout.Flex>
                  </FlexLayout>
                </FlexLayout.Fixed>
                <FlexLayout.Flex>
                  <ListGroup style={{ height: "100%" }}>
                    {availableExtensions
                      .filter(this.filterSearch)
                      .sort(this.extensionSort)
                      .map(this.renderListEntry)}
                  </ListGroup>
                </FlexLayout.Flex>
                <FlexLayout.Fixed>
                  <div className="extension-list-time">
                    {t("Last updated: {{time}}", {
                      replace: { time: updatedAt.toLocaleString(language) },
                    })}
                    <IconButton
                      icon="refresh"
                      tooltip={t("Refresh")}
                      onClick={onRefreshExtensions}
                    />
                  </div>
                </FlexLayout.Fixed>
              </FlexLayout>
            </FlexLayout.Fixed>
            <FlexLayout.Flex fill={true}>
              {ext === null ? null : this.renderDescription(ext)}
            </FlexLayout.Flex>
          </FlexLayout>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onHide}>{t("Close")}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private changeSearch = (newValue: string) => {
    this.nextState.searchTerm = newValue ?? "";
  };

  private changeSort = (evt: React.FormEvent<FormControl>) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.nextState.sort = target.value as SortOrder;
  };

  private filterSearch = (test: IAvailableExtension) => {
    const { searchTerm } = this.state;

    if (!searchTerm) {
      return true;
    }

    const searchTermNorm = searchTerm.toUpperCase();

    return (
      test.name.toUpperCase().includes(searchTermNorm) ||
      test.author.toUpperCase().includes(searchTermNorm)
    );
  };

  private extensionSort = (lhs: IAvailableExtension, rhs: IAvailableExtension): number =>
    this.state.sort === "recent"
      ? (rhs.timestamp || 0) - (lhs.timestamp || 0)
      : lhs.name.localeCompare(rhs.name);

  private isInstalled(ext: IAvailableExtension): boolean {
    return findInstalled(this.props.extensions, { modId: ext.modId }) !== undefined;
  }

  private renderAction(ext: IAvailableExtension): React.JSX.Element {
    const { t } = this.props;
    const { installing } = this.state;

    return installing.indexOf(ext.name) !== -1 ? (
      <Spinner />
    ) : this.isInstalled(ext) ? (
      <div>{t("Installed")}</div>
    ) : (
      <a className="extension-subscribe" data-modid={ext.modId} onClick={this.install}>
        {t("Install")}
      </a>
    );
  }

  private renderListEntry = (ext: IAvailableExtension) => {
    const { selected } = this.state;

    const classes = ["extension-item"];

    if (selectorMatch(ext, selected)) {
      classes.push("selected");
    }

    return (
      <ListGroupItem
        className={classes.join(" ")}
        key={makeSelectorId(ext)}
        data-modid={ext.modId}
        onClick={this.select}
        disabled={this.isInstalled(ext)}
      >
        <div className="extension-header">
          <div className="extension-title">
            <span className="extension-name">{ext.name}</span>
            <span className="extension-version">{ext.version}</span>
          </div>
        </div>
        <div className="extension-footer">
          <div className="extension-author">{ext.author}</div>
          {this.renderAction(ext)}
        </div>
      </ListGroupItem>
    );
  };

  private renderDescription = (ext: IAvailableExtension) => {
    const { t } = this.props;
    if (ext === undefined) {
      return null;
    }

    const openInBrowser = (
      <a className="extension-browse" data-modid={ext.modId} onClick={this.openPage}>
        <Icon name="open-in-browser" />
        {t("Open in Browser")}
      </a>
    );

    const details = this.state.descriptions[ext.modId];

    return (
      <FlexLayout type="column">
        <FlexLayout.Fixed>
          <FlexLayout type="row" className="description-header" fill={false}>
            <FlexLayout.Fixed>
              <div className="description-image-container">
                <ZoomableImage className="extension-picture" url={ext.image} />
              </div>
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <FlexLayout type="column" className="description-header-content">
                <div className="description-title">
                  <span className="description-name">{ext.name}</span>
                  <span className="description-author">
                    {t("by")} {ext.author}
                  </span>
                </div>
                {details?.summary !== undefined ? (
                  <div className="description-short">{details.summary}</div>
                ) : null}
                <div className="description-actions">
                  {this.renderAction(ext)} {openInBrowser}
                </div>
              </FlexLayout>
            </FlexLayout.Flex>
          </FlexLayout>
        </FlexLayout.Fixed>
        <FlexLayout.Flex>
          <div className="description-text">
            {details === undefined ? <Spinner /> : bbcode(details.description ?? "")}
          </div>
        </FlexLayout.Flex>
      </FlexLayout>
    );
  };

  private install = (evt: React.MouseEvent<any>) => {
    const { availableExtensions } = this.props;

    const modIdStr = evt.currentTarget.getAttribute("data-modid");
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;

    const ext = findInCatalog(availableExtensions, { modId });
    this.nextState.installing.push(ext.name);

    void (async () => {
      try {
        const success = await downloadAndInstallExtension(this.context.api, ext);
        if (success) {
          await this.props.updateExtensions();
        }
      } catch (err) {
        this.context.api.showErrorNotification("Failed to install extension", err);
      } finally {
        this.nextState.installing = this.state.installing.filter((name) => name !== ext.name);
      }
    })();
  };

  private select = (evt: React.MouseEvent<any>) => {
    const modIdStr = evt.currentTarget.getAttribute("data-modid");
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;
    this.nextState.selected = { modId };
    this.fetchDescription(modId);
  };

  private fetchDescription = (modId: number | undefined) => {
    if (modId === undefined || this.nextState.descriptions[modId] !== undefined) return;

    void (async () => {
      try {
        const info = await this.context.api.ext.nexusGetModInfo?.(SITE_ID, modId);
        this.nextState.descriptions[modId] = {
          summary: info?.summary,
          description: info?.description,
        };
      } catch (err) {
        log("warn", "failed to fetch extension description", {
          modId,
          error: getErrorMessageOrDefault(err),
        });
        this.nextState.descriptions[modId] = {};
      }
    })();
  };

  private openPage = (evt: React.MouseEvent<any>) => {
    const { availableExtensions } = this.props;

    const modIdStr = evt.currentTarget.getAttribute("data-modid");
    const modId = modIdStr !== null ? parseInt(modIdStr, 10) : undefined;

    const ext = findInCatalog(availableExtensions, { modId });
    if (ext.modId !== undefined) {
      opn(NEXUS_MODS_URL + ext.modId).catch(() => null);
    }
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    availableExtensions: state.session.extensions.available,
    extensions: state.app.extensions ?? {},
    updateTime: state.session.extensions.updateTime,
    language: state.settings.interface.language,
  };
}

export default translate(["common"])(connect(mapStateToProps)(BrowseExtensions));
