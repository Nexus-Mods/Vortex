import { setImportStep } from "../actions/session";

import { ModsCapacityMap, ICapacityInfo } from "../types/capacityTypes";
import {
  IModEntry,
  ModsMap,
  ParseError,
  ProgressCB,
} from "../types/nmmEntries";
import { getCategories } from "../util/categories";
import findInstances from "../util/findInstances";
import importArchives from "../util/import";
import parseNMMConfigFile from "../util/nmmVirtualConfigParser";

import TraceImport from "../util/TraceImport";

import {
  FILENAME,
  LOCAL,
  MOD_ID,
  MOD_NAME,
  MOD_VERSION,
} from "../importedModAttributes";

import * as React from "react";
import {
  Alert,
  Button,
  ListGroup,
  ListGroupItem,
  MenuItem,
  ProgressBar,
  SplitButton,
} from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";

import {
  ComponentEx,
  EmptyPlaceholder,
  Icon,
  ITableRowAction,
  log,
  Modal,
  selectors,
  Spinner,
  Steps,
  Table,
  Toggle,
  tooltip,
  types,
  util,
} from "vortex-api";

import Promise from "bluebird";

import {
  calculateModsCapacity,
  generateModEntries,
  getLocalAssetUrl,
  getCapacityInformation,
  getCategoriesFilePath,
  getVirtualConfigFilePath,
  testAccess,
  validate,
} from "../util/util";

type Step = "start" | "setup" | "working" | "review";

interface IConnectedProps {
  gameId: string;
  downloadPath: string;
  installPath: string;
  importStep?: Step;
}

interface IActionProps {
  onSetStep: (newState: Step) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  busy: boolean;
  sources: string[][];
  selectedSource: string[];
  modsToImport: { [id: string]: IModEntry };
  parsedMods: { [id: string]: IModEntry };
  error: string;
  importEnabled: { [id: string]: boolean };
  counter: number;
  progress: { mod: string; pos: number };
  failedImports: string[];

  // Dictates whether we can start the import process.
  nmmModsEnabled: boolean;
  nmmRunning: boolean;

  // State of the plugin sorting functionality.
  autoSortEnabled: boolean;

  // Disk space calculation variables.
  capacityInformation: ICapacityInfo;
  modsCapacity: ModsCapacityMap;

  // Array of successfully imported mod entries.
  successfullyImported: IModEntry[];

  // Dictates whether the installation process
  //  should be kicked off immediately after the user
  //  has closed the review page.
  installModsOnFinish: boolean;
}

class ImportDialog extends ComponentEx<IProps, IComponentState> {
  private static STEPS: Step[] = ["start", "setup", "working", "review"];

  private mStatus: types.ITableAttribute;
  private mTrace: TraceImport;
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);

    this.initState({
      busy: false,
      sources: undefined,
      modsToImport: undefined,
      parsedMods: undefined,
      selectedSource: [],
      error: undefined,
      importEnabled: {},
      modsCapacity: {},
      counter: 0,
      progress: undefined,
      failedImports: [],
      nmmModsEnabled: false,
      nmmRunning: false,
      autoSortEnabled: false,

      capacityInformation: {
        rootPath: "",
        totalNeededBytes: 0,
        totalFreeBytes: 0,
        hasCalculationErrors: false,
      },

      installModsOnFinish: false,
      successfullyImported: [],
    });

    this.actions = [
      {
        icon: "checkbox-checked",
        title: "Import",
        action: this.importSelected,
        singleRowAction: false,
      },
      {
        icon: "checkbox-unchecked",
        title: "Don't Import",
        action: this.dontImportSelected,
        singleRowAction: false,
      },
    ];

    this.mStatus = {
      id: "status",
      name: "Import",
      description: "The import status of the mod",
      icon: "level-up",
      calc: (mod: IModEntry) =>
        this.isModEnabled(mod) ? "Import" : "Don't import",
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isVolatile: true,
      edit: {
        inline: true,
        choices: () => [
          { key: "yes", text: "Import" },
          { key: "no", text: "Don't import" },
        ],
        onChangeValue: (mod: IModEntry, value: any) => {
          this.nextState.importEnabled[mod.modFilename] =
            value === undefined
              ? mod.isAlreadyManaged
                ? !(this.state.importEnabled[mod.modFilename] === true)
                : !(this.state.importEnabled[mod.modFilename] !== false)
              : value === "yes";
          ++this.nextState.counter;
          this.recalculate();
        },
      },
    };
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.importStep !== newProps.importStep) {
      if (newProps.importStep === "start") {
        this.resetStateData();
        this.start();
      } else if (newProps.importStep === "setup") {
        this.setup();
      } else if (newProps.importStep === "working") {
        this.startImport();
      } else if (newProps.importStep === "review") {
        this.nextState.successfullyImported = this.getSuccessfullyImported();
      }
    }
  }

  public render(): JSX.Element {
    const { t, importStep } = this.props;
    const { error, sources, capacityInformation } = this.state;

    const canCancel =
      ["start", "setup"].indexOf(importStep) !== -1 ||
      (importStep === "working" && !this.canImport()) ||
      error !== undefined;
    const nextLabel =
      sources !== undefined && sources.length > 0
        ? this.nextLabel(importStep)
        : undefined;

    const onClick = () =>
      importStep !== "review" ? this.next() : this.finish();

    return (
      <Modal
        id="import-dialog"
        show={importStep !== undefined}
        onHide={this.nop}
      >
        <Modal.Header>
          <Modal.Title>{t("Nexus Mod Manager (NMM) Import Tool")}</Modal.Title>
          {this.renderCurrentStep()}
        </Modal.Header>
        <Modal.Body>
          {error !== undefined ? (
            <Alert bsStyle="danger">{error}</Alert>
          ) : (
            this.renderContent(importStep)
          )}
        </Modal.Body>
        <Modal.Footer>
          {importStep === "setup" &&
          capacityInformation.hasCalculationErrors ? (
            <Alert bsStyle="danger">
              {t(
                "Vortex cannot validate NMM's mod/archive files - this usually occurs when " +
                  "the NMM configuration is corrupt",
              )}
            </Alert>
          ) : null}
          {canCancel ? (
            <Button onClick={this.cancel}>{t("Cancel")}</Button>
          ) : null}
          {nextLabel ? (
            <Button disabled={this.isNextDisabled()} onClick={onClick}>
              {nextLabel}
            </Button>
          ) : null}
        </Modal.Footer>
      </Modal>
    );
  }

  // Reset all previously set data.
  private resetStateData() {
    this.nextState.sources = undefined;
    this.nextState.modsToImport = undefined;
    this.nextState.parsedMods = undefined;
    this.nextState.selectedSource = [];
    this.nextState.error = undefined;
    this.nextState.importEnabled = {};
    this.nextState.counter = 0;
    this.nextState.progress = undefined;
    this.nextState.failedImports = [];
    this.nextState.capacityInformation = {
      rootPath: "",
      totalNeededBytes: 0,
      totalFreeBytes: 0,
      hasCalculationErrors: false,
    };
    this.nextState.installModsOnFinish = false;
    this.nextState.autoSortEnabled = false;
    this.nextState.successfullyImported = [];
  }

  private canImport() {
    const { nmmModsEnabled, nmmRunning } = this.state;
    return !nmmModsEnabled && !nmmRunning;
  }

  private onGroupAction(entries: string[], enable: boolean) {
    const { importEnabled, modsToImport } = this.state;
    if (modsToImport === undefined) {
      // happens if there are no NMM mods for this game
      return Promise.resolve();
    }
    entries.forEach((key: string) => {
      if (importEnabled[key] !== undefined && importEnabled[key] === enable) {
        return;
      }

      // We're going to assign this value even if importEnabled object doesn't have
      //  a record of this key - which is a valid case when we just open up the
      //  NMM tool.
      this.nextState.importEnabled[key] = enable;
    });

    this.recalculate();
  }

  private importSelected = (entries) => {
    this.onGroupAction(entries, true);
  };

  private dontImportSelected = (entries) => {
    this.onGroupAction(entries, false);
  };

  private recalculate() {
    const { modsToImport } = this.state;
    const validCalcState =
      modsToImport !== undefined && Object.keys(modsToImport).length > 0;
    this.nextState.capacityInformation.hasCalculationErrors = false;
    this.nextState.capacityInformation.totalNeededBytes = validCalcState
      ? this.calcArchiveFiles()
      : 0;
  }

  private getModNumber(): string {
    const { modsToImport } = this.state;
    if (modsToImport === undefined) {
      return undefined;
    }

    const modList = Object.keys(modsToImport).map((id) => modsToImport[id]);
    const enabledMods = modList.filter((mod) => this.isModEnabled(mod));

    return `${enabledMods.length} / ${modList.length}`;
  }

  private onStartUp(): Promise<void> {
    const { selectedSource } = this.state;
    const { parsedMods } = this.nextState;
    if (selectedSource === undefined || parsedMods === undefined) {
      // happens if there are no NMM mods for this game, or if we were
      //  unable to find source instances.
      return Promise.resolve();
    }

    const progCB = (err: Error, mod: string) => {
      if (err) {
        this.nextState.capacityInformation.hasCalculationErrors = true;
      }
      this.nextState.progress = { mod, pos: 0 };
    };
    return this.populateModsTable(progCB).then((mods) => {
      this.nextState.modsToImport = mods;
      const modList = Object.keys(mods).map((id) => mods[id]);
      return this.getModsCapacity(modList, progCB);
    });
  }

  private getModsCapacity(modList: IModEntry[], cb: ProgressCB): Promise<void> {
    return (calculateModsCapacity(modList, cb) as any).then(
      (modCapacityInfo) => {
        this.nextState.modsCapacity = modCapacityInfo;
        this.recalculate();
      },
    );
  }

  private calcArchiveFiles(): number {
    const { modsCapacity, modsToImport } = this.nextState;
    return Object.keys(modsCapacity)
      .filter((id) => this.modWillBeEnabled(modsToImport[id]))
      .map((id) => modsCapacity[id])
      .reduce((total, archiveBytes) => total + archiveBytes, 0);
  }

  // To be used after the import process finished. Will return
  //  an array containing successfully imported archives.
  private getSuccessfullyImported(): IModEntry[] {
    const { failedImports, modsToImport } = this.state;
    const enabledMods = Object.keys(modsToImport ?? [])
      .map((id) => modsToImport[id])
      .filter((mod) => this.isModEnabled(mod));

    if (failedImports === undefined || failedImports.length === 0) {
      return enabledMods;
    }

    return enabledMods.filter(
      (mod) => failedImports.find((fail) => fail === mod.modName) === undefined,
    );
  }

  private renderCapacityInfo(instance: ICapacityInfo): JSX.Element {
    const { t } = this.props;
    return (
      <div>
        <h3
          className={
            instance.totalNeededBytes > instance.totalFreeBytes
              ? "disk-space-insufficient"
              : "disk-space-sufficient"
          }
        >
          {t("{{rootPath}} - Size required: {{required}} / {{available}}", {
            replace: {
              rootPath: instance.rootPath,
              required: instance.hasCalculationErrors
                ? "???"
                : util.bytesToString(instance.totalNeededBytes),
              available: util.bytesToString(instance.totalFreeBytes),
            },
          })}
        </h3>
      </div>
    );
  }

  private isNextDisabled = () => {
    const { importStep } = this.props;
    const { error, modsToImport, capacityInformation } = this.state;

    const enabled =
      modsToImport !== undefined
        ? Object.keys(modsToImport).filter((id) =>
            this.isModEnabled(modsToImport[id]),
          )
        : [];

    // We don't want to fill up the user's harddrive.
    const totalFree = capacityInformation.totalFreeBytes;
    const hasSpace = capacityInformation.totalNeededBytes > totalFree;
    return (
      error !== undefined ||
      (importStep === "setup" && modsToImport === undefined) ||
      (importStep === "setup" && enabled.length === 0) ||
      (importStep === "setup" && hasSpace)
    );
  };

  private renderCurrentStep(): JSX.Element {
    const { t, importStep } = this.props;

    return (
      <Steps step={importStep} style={{ marginBottom: 32 }}>
        <Steps.Step
          key="start"
          stepId="start"
          title={t("Start")}
          description={t("Introduction")}
        />
        <Steps.Step
          key="setup"
          stepId="setup"
          title={t("Setup")}
          description={t("Select Mods to import")}
        />
        <Steps.Step
          key="working"
          stepId="working"
          title={t("Import")}
          description={t("Magic happens")}
        />
        <Steps.Step
          key="review"
          stepId="review"
          title={t("Review")}
          description={t("Import result")}
        />
      </Steps>
    );
  }

  private openLink = (evt: React.MouseEvent<HTMLAnchorElement>) => {
    evt.preventDefault();
    const link = evt.currentTarget.getAttribute("data-link");
    util.opn(link).catch(() => null);
  };

  private getLink(link: string, text: string): JSX.Element {
    const { t } = this.props;
    return (
      <a data-link={link} onClick={this.openLink}>
        {t(`${text}`)}
      </a>
    );
  }

  private renderContent(state: Step): JSX.Element {
    switch (state) {
      case "start":
        return this.renderStart();
      case "setup":
        return this.renderSelectMods();
      case "working":
        return this.canImport()
          ? this.renderWorking()
          : this.renderValidation();
      case "review":
        return this.renderReview();
      default:
        return null;
    }
  }

  private renderStart(): JSX.Element {
    const { t } = this.props;
    const { sources, selectedSource } = this.state;

    const positives: string[] = [
      "Copy over all archives found inside the selected NMM installation.",

      "Provide the option to install imported archives at the end of the " +
        "import process.",

      "Leave your existing NMM installation disabled, but functionally intact.",
    ];

    const negatives: string[] = [
      "Import any mod files in your data folder that are not managed by NMM.",

      "Import your FOMOD options.",

      "Preserve your plugin load order, as plugins will be rearranged according " +
        "to LOOT rules once enabled.",
    ];

    const renderItem = (
      text: string,
      idx: number,
      positive: boolean,
    ): JSX.Element => (
      <div key={idx} className="import-description-item">
        <Icon name={positive ? "feedback-success" : "feedback-error"} />
        <p>{t(text)}</p>
      </div>
    );

    const renderPositives = (): JSX.Element => (
      <div className="import-description-column import-description-positive">
        <h4>{t("The import tool will:")}</h4>
        <span>
          {positives.map((positive, idx) => renderItem(positive, idx, true))}
        </span>
      </div>
    );

    const renderNegatives = (): JSX.Element => (
      <div className="import-description-column import-description-negative">
        <h4>{t("The import tool won’t:")}</h4>
        <span>
          {negatives.map((negative, idx) => renderItem(negative, idx, false))}
        </span>
      </div>
    );

    return (
      <span className="import-start-container">
        <div>
          {t(
            "This is an import tool that allows you to bring your mod archives over from an " +
              "existing NMM installation.",
          )}{" "}
          <br />
        </div>
        <div className="start-info">
          {renderPositives()}
          {renderNegatives()}
        </div>
        {sources === undefined ? (
          <Spinner />
        ) : sources.length === 0 ? (
          this.renderNoSources()
        ) : (
          this.renderSources(sources, selectedSource)
        )}
      </span>
    );
  }

  private renderNoSources(): JSX.Element {
    const { t } = this.props;

    return (
      <span className="import-errors">
        <Icon name="feedback-error" />{" "}
        {t(
          "No NMM install found with mods for this game. " +
            "Please note that only NMM >= 0.63 is supported.",
        )}
      </span>
    );
  }

  private renderSources(
    sources: string[][],
    selectedSource: string[],
  ): JSX.Element {
    const { t } = this.props;

    return (
      <div>
        {t(
          "If you have multiple instances of NMM installed you can select which one " +
            "to import here:",
        )}
        <br />
        <SplitButton
          id="import-select-source"
          title={selectedSource !== undefined ? selectedSource[0] || "" : ""}
          onSelect={this.selectSource}
        >
          {sources.map(this.renderSource)}
        </SplitButton>
      </div>
    );
  }

  private renderSource = (option) => {
    return (
      <MenuItem key={option} eventKey={option}>
        {option[0]}
      </MenuItem>
    );
  };

  private toggleInstallOnFinish = () => {
    const { installModsOnFinish } = this.state;
    this.nextState.installModsOnFinish = !installModsOnFinish;
  };

  private revalidate = () => {
    const { selectedSource } = this.state;
    return validate(selectedSource[0]).then((res) => {
      this.nextState.nmmModsEnabled = res.nmmModsEnabled;
      this.nextState.nmmRunning = res.nmmRunning;
      this.nextState.busy = false;
    });
  };

  private renderValidation(): JSX.Element {
    const { t } = this.props;
    const { busy, nmmModsEnabled, nmmRunning } = this.state;
    const content = (
      <div className="is-not-valid">
        <div className="not-valid-title">
          <Icon name="input-cancel" />
          <h2>{t("Can't continue")}</h2>
        </div>
        <ListGroup>
          {nmmModsEnabled ? (
            <ListGroupItem>
              <h4>{t("Please disable all mods in NMM")}</h4>
              <p>
                {t(
                  "NMM and Vortex would interfere with each other if they both " +
                    "tried to manage the same mods.",
                )}
                {t("You don't have to uninstall the mods, just disable them.")}
              </p>
              <img src={getLocalAssetUrl("disablenmm.png")} />
            </ListGroupItem>
          ) : null}
          {nmmRunning ? (
            <ListGroupItem>
              <h4>{t("Please close NMM")}</h4>
              <p>
                {t(
                  "NMM needs to be closed during the import process and generally " +
                    "while Vortex is installing mods otherwise it may interfere.",
                )}
              </p>
            </ListGroupItem>
          ) : null}
        </ListGroup>
        <div className="revalidate-area">
          <tooltip.IconButton
            id="revalidate-button"
            icon={busy ? "spinner" : "refresh"}
            tooltip={busy ? t("Checking") : t("Check again")}
            disabled={busy}
            onClick={this.revalidate}
          >
            {t("Check again")}
          </tooltip.IconButton>
        </div>
      </div>
    );

    return content;
  }

  private renderSelectMods(): JSX.Element {
    const { t } = this.props;
    const { counter, modsToImport, progress, capacityInformation } = this.state;

    const calcProgress = !!progress ? (
      <span>
        <h3>
          {t("Calculating required disk space. Thank you for your patience.")}
        </h3>
        {t("Scanning: {{mod}}", { replace: { mod: progress.mod } })}
      </span>
    ) : (
      <span>
        <h3>
          {t("Processing NMM cache information. Thank you for your patience.")}
        </h3>
        {t("Looking up archives..")}
      </span>
    );

    const content =
      modsToImport === undefined ? (
        <div className="status-container">
          <Icon name="spinner" />
          {calcProgress}
        </div>
      ) : (
        <Table
          tableId="mods-to-import"
          data={modsToImport}
          dataId={counter}
          actions={this.actions}
          staticElements={[
            this.mStatus,
            MOD_ID,
            MOD_NAME,
            MOD_VERSION,
            FILENAME,
            LOCAL,
          ]}
        />
      );
    const modNumberText = this.getModNumber();
    return (
      <div className="import-mods-selection">
        {content}
        {modNumberText !== undefined ? (
          <div>
            <h3>{t(`Importing: ${this.getModNumber()} mods`)}</h3>
            {this.renderCapacityInfo(capacityInformation)}
          </div>
        ) : null}
      </div>
    );
  }

  private renderWorking(): JSX.Element {
    const { t } = this.props;
    const { progress, modsToImport } = this.state;
    if (progress === undefined) {
      return null;
    }
    const enabledMods = Object.keys(modsToImport).filter((id) =>
      this.isModEnabled(modsToImport[id]),
    );
    const perc = Math.floor((progress.pos * 100) / enabledMods.length);
    return (
      <div className="import-working-container">
        <EmptyPlaceholder
          icon="folder-download"
          text={t("Importing Mods...")}
          subtext={t("This might take a while, please be patient")}
        />
        {t("Currently importing: {{mod}}", { replace: { mod: progress.mod } })}
        <ProgressBar now={perc} label={`${perc}%`} />
      </div>
    );
  }

  private renderEnableModsOnFinishToggle(): JSX.Element {
    const { t } = this.props;
    const { successfullyImported, installModsOnFinish } = this.state;

    return successfullyImported.length > 0 ? (
      <div>
        <Toggle
          checked={installModsOnFinish}
          onToggle={this.toggleInstallOnFinish}
        >
          {t("Install imported mods")}
        </Toggle>
      </div>
    ) : null;
  }

  private renderReviewSummary(): JSX.Element {
    const { t } = this.props;
    const { successfullyImported } = this.state;

    return successfullyImported.length > 0 ? (
      <div>
        {t(
          "Your selected mod archives have been imported successfully. You can decide now ",
        )}
        {t(
          "whether you would like to start the installation for all imported mods,",
        )}{" "}
        <br />
        {t("or whether you want to install these yourself at a later time.")}
        <br />
        <br />
        {this.renderEnableModsOnFinishToggle()}
      </div>
    ) : null;
  }

  private renderReview(): JSX.Element {
    const { t } = this.props;
    const { failedImports } = this.state;

    return (
      <div className="import-working-container">
        {failedImports.length === 0 ? (
          <span className="import-success">
            <Icon name="feedback-success" /> {t("Import successful")}
            <br />
          </span>
        ) : (
          <span className="import-errors">
            <Icon name="feedback-error" /> {t("There were errors")}
          </span>
        )}
        <span className="import-review-text">
          {t("You can review the log at: ")}
          <a onClick={this.openLog}>{this.mTrace.logFilePath}</a>
        </span>
        <br />
        <br />
        <span>
          {this.renderReviewSummary()}
          <br />
          <br />
        </span>
      </div>
    );
  }

  private openLog = (evt) => {
    evt.preventDefault();
    (util as any).opn(this.mTrace.logFilePath).catch((err) => undefined);
  };

  private nextLabel(step: Step): string {
    const { t } = this.props;
    switch (step) {
      case "start":
        return t("Next");
      case "setup":
        return t("Start Import");
      case "working":
        return null;
      case "review":
        return t("Finish");
    }
  }

  private selectSource = (eventKey) => {
    this.nextState.selectedSource = eventKey;
  };

  private nop = () => undefined;

  private cancel = () => {
    this.props.onSetStep(undefined);
  };

  private next() {
    const { onSetStep, importStep } = this.props;
    const currentIdx = ImportDialog.STEPS.indexOf(importStep);
    onSetStep(ImportDialog.STEPS[currentIdx + 1]);
  }

  private finish() {
    const { installModsOnFinish } = this.state;

    // We're only interested in the mods we actually managed to import.
    const imported = this.getSuccessfullyImported();

    // If we did not succeed in importing anything, there's no point in
    //  enabling anything.
    if (imported.length === 0) {
      this.next();
      return;
    }

    // Check whether the user wants Vortex to automatically install all imported
    //  mod archives.
    if (installModsOnFinish) {
      this.installMods(imported);
    }

    this.next();
  }

  private installMods(modEntries: IModEntry[]) {
    const state = this.context.api.store.getState();
    const downloads = util.getSafe(
      state,
      ["persistent", "downloads", "files"],
      undefined,
    );
    if (downloads === undefined) {
      // We clearly didn't manage to import anything.
      return Promise.reject(new Error("persistent.downloads.files is empty!"));
    }

    const archiveIds = Object.keys(downloads).filter(
      (key) =>
        modEntries.find(
          (mod) => mod.modFilename === downloads[key].localPath,
        ) !== undefined,
    );
    return Promise.each(archiveIds, (archiveId) => {
      this.context.api.events.emit("start-install-download", archiveId, true);
    });
  }

  private start() {
    const { downloadPath } = this.props;
    this.nextState.error = undefined;

    // Store the initial value of the plugin sorting functionality (if it's even applicable)
    this.nextState.autoSortEnabled = util.getSafe(
      this.context.api.store.getState(),
      ["settings", "plugins", "autosort"],
      false,
    );

    try {
      const capInfo = getCapacityInformation(downloadPath);
      this.nextState.capacityInformation = {
        ...this.state.capacityInformation,
        rootPath: capInfo.rootPath,
        totalFreeBytes: capInfo.totalFreeBytes,
      };
    } catch (err) {
      this.context.api.showErrorNotification(
        "Unable to start import process",
        err,
        {
          // don't allow report on "not found" and permission errors
          allowReport: [2, 3, 5].indexOf(err.systemCode) === -1,
        },
      );
      this.cancel();
    }

    return findInstances(this.props.gameId)
      .then((found) => {
        this.nextState.sources = found;
        this.nextState.selectedSource = found[0];
      })
      .catch((err) => {
        this.nextState.error = err.message;
      });
  }

  private setup() {
    const { gameId } = this.props;
    const state: types.IState = this.context.api.store.getState();
    const mods = state.persistent.mods[gameId] || {};
    const virtualPath = getVirtualConfigFilePath(this.state.selectedSource[0]);
    return testAccess(this.props.t, this.state.selectedSource[2])
      .then(() => parseNMMConfigFile(virtualPath, mods))
      .catch((err) =>
        err instanceof ParseError ? Promise.resolve([]) : Promise.reject(err),
      )
      .then((modEntries: IModEntry[]) => {
        this.nextState.parsedMods = modEntries.reduce((prev, value) => {
          // modfilename appears to be the only field that we can rely on being set and it being
          // unique
          prev[value.modFilename] = value;
          return prev;
        }, {});
      })
      .catch((err) => {
        this.nextState.error = err.message;
      })
      .finally(() => this.onStartUp());
  }

  private populateModsTable(cb: ProgressCB): Promise<ModsMap> {
    const { t } = this.props;
    const { selectedSource, parsedMods } = this.state;
    const api = this.context.api;
    return (
      generateModEntries(api, selectedSource, parsedMods, cb) as any
    ).catch((err) => {
      log("error", "Failed to create mod entry", err);
      const errorMessage =
        err.code === "EPERM"
          ? t(
              '"{{permFile}}" is access protected. Please ensure your account has ' +
                "full read/write permissions to your game's NMM mods folder and try again.",
              { replace: { permFile: err.path } },
            )
          : err.message;
      this.nextState.error = errorMessage;
      return Promise.resolve({});
    });
  }

  private modWillBeEnabled(mod: IModEntry): boolean {
    return (
      this.nextState.importEnabled[mod.modFilename] !== false &&
      !(
        this.nextState.importEnabled[mod.modFilename] === undefined &&
        mod.isAlreadyManaged
      )
    );
  }

  private isModEnabled(mod: IModEntry): boolean {
    return (
      this.state.importEnabled[mod.modFilename] !== false &&
      !(
        this.state.importEnabled[mod.modFilename] === undefined &&
        mod.isAlreadyManaged
      )
    );
  }

  private startImport() {
    const { gameId } = this.props;
    const { autoSortEnabled, modsToImport, selectedSource } = this.state;

    if (autoSortEnabled) {
      // We don't want the sorting functionality to kick off as the user
      //  is removing plugins through NMM with Vortex open.
      this.context.api.events.emit("autosort-plugins", false);
    }

    const startImportProcess = (): Promise<void> => {
      if (autoSortEnabled) {
        // If we're able to start the import process, then clearly
        //  the user had already disabled the mods through NMM
        //  should be safe to turn autosort back on.
        this.context.api.events.emit("autosort-plugins", true);
      }

      try {
        this.mTrace = new TraceImport();
      } catch (err) {
        if (err.code === "EEXIST") {
          return Promise.delay(1000).then(() => startImportProcess());
        } else {
          this.context.api.showErrorNotification(
            "Failed to initialize trace log for NMM import",
            err,
          );
          return Promise.resolve();
        }
      }
      const modList = Object.keys(modsToImport).map((id) => modsToImport[id]);
      const enabledMods = modList.filter((mod) => this.isModEnabled(mod));
      const modsPath = selectedSource[2];
      this.mTrace.initDirectory(selectedSource[0]);
      // The categories.xml file seems to be created by NMM inside its defined "modFolder"
      //  and not inside the virtual folder.
      return getCategories(getCategoriesFilePath(modsPath))
        .catch((err) => {
          // Do not stop the import process just because we can't import categories.
          this.mTrace.log("error", "Failed to import categories from NMM", err);
          return Promise.resolve({});
        })
        .then((categories) => {
          this.mTrace.log(
            "info",
            "NMM Mods (count): " +
              modList.length +
              " - Importing (count):" +
              enabledMods.length,
          );
          this.context.api.events.emit("enable-download-watch", false);

          return importArchives(
            this.context.api,
            gameId,
            this.mTrace,
            modsPath,
            enabledMods,
            categories,
            (mod: string, pos: number) => {
              this.nextState.progress = { mod, pos };
            },
          ).then((errors) => {
            this.context.api.events.emit("enable-download-watch", true);
            this.nextState.failedImports = errors;
            this.props.onSetStep("review");
          });
        })
        .catch((err) => {
          this.context.api.events.emit("enable-download-watch", true);
          this.nextState.error = err.message;
        });
    };

    const validateLoop = (): Promise<void> => {
      if (this.canImport()) {
        return Promise.resolve(startImportProcess());
      } else {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            validateLoop().then(resolve);
          }, 2000);
        });
      }
    };

    this.nextState.busy = true;
    return this.revalidate().then(() => validateLoop());
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameId = selectors.activeGameId(state);

  return {
    gameId,
    importStep: state.session.modimport.importStep || undefined,
    downloadPath: selectors.downloadPath(state),
    installPath:
      gameId !== undefined
        ? selectors.installPathForGame(state, gameId)
        : undefined,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onSetStep: (step?: Step) => dispatch(setImportStep(step)),
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(ImportDialog) as any,
) as React.ComponentClass<{}>;
