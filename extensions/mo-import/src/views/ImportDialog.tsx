import { IModEntry } from '../types/moEntries';
import findInstances, { instancesPath } from '../util/findInstances';
import importMods from '../util/import';
import parseMOIni, { IMOConfig } from '../util/parseMOIni';
import readModEntries from '../util/readModEntries';
import TraceImport from '../util/TraceImport';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as I18next from 'i18next';
import * as opn from 'opn';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, ControlLabel, DropdownButton, FormControl, FormGroup,
  InputGroup, MenuItem, ProgressBar,
} from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ComponentEx, Icon, ITableRowAction, log, Modal, selectors, Steps, Table,
         TableNumericFilter, TableTextFilter, Toggle,
         tooltip, types, util,
} from 'vortex-api';

type Step = 'start' | 'setup' | 'working' | 'review' | 'wait';

interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
  gameId: string;
  discovered: { [gameId: string]: types.IDiscoveryResult };
  mods: { [modId: string]: types.IMod };
}

interface IActionProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  importStep: Step;
  error?: string;
  importEnabled: { [id: string]: boolean };
  instances: string[];
  importArchives: boolean;
  importPathInvalid?: string;
  importPath?: string;
  importMOConfig?: IMOConfig;
  progress?: { mod: string, perc: number };
  failedImports: string[];
  modsToImport: { [id: string]: IModEntry };
  counter: number;
}

class ImportDialog extends ComponentEx<IProps, IComponentState> {
  private static STEPS: Step[] = [ 'start', 'setup', 'working', 'review' ];

  private mAttributes: types.ITableAttribute[];
  private mActions: ITableRowAction[];
  private mTrace: TraceImport;
  private mUpdatePathDebouncer: util.Debouncer;

  constructor(props: IProps) {
    super(props);

    this.initState({
      importStep: undefined,
      importArchives: false,
      importEnabled: {},
      instances: [],
      failedImports: [],
      counter: 0,
      modsToImport: {},
    });

    this.mUpdatePathDebouncer = new util.Debouncer(() => {
      const { t, discovered, gameId } = this.props;
      const { importPath, importPathInvalid } = this.state;
      return parseMOIni(discovered, importPath)
        .then(moconfig => {
          this.nextState.importPathInvalid = (moconfig.game === gameId)
            ? undefined
            : t('Can\'t import mods from different game: {{gameId}}',
              { replace: { gameId: moconfig.game } });
        })
        .catch(err => {
          log('warn', 'invalid MO directory', { error: err.messag });
          this.nextState.importPathInvalid = t('No or invalid MO installation');
        });
    }, 500);

    this.mAttributes = this.genAttributes();
    this.mActions = this.genActions();
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (!this.props.visible && newProps.visible) {
      this.start();
    }
  }

  public render(): JSX.Element {
    const { t, visible } = this.props;
    const { error, importStep, instances } = this.state;

    const canCancel = ['start', 'setup'].indexOf(importStep) !== -1;
    const nextLabel = ((instances !== undefined) && (instances.length > 0))
      ? this.nextLabel(importStep)
      : undefined;

    return (
      <Modal id='import-dialog' show={visible} onHide={this.nop}>
        <Modal.Header>
          <Modal.Title>{t('Mod Organizer (MO) Migration Tool')}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
          {this.renderStep(importStep)}
          {error !== undefined ? <Alert>{error}</Alert> : this.renderContent(importStep)}
        </Modal.Body>
        <Modal.Footer>
          {canCancel ? <Button onClick={this.cancel}>{t('Cancel')}</Button> : null}
          { nextLabel ? (
            <Button disabled={this.nextDisabled()} onClick={this.next}>{nextLabel}</Button>
           ) : null }
        </Modal.Footer>
      </Modal>
    );
  }

  private renderStep(step: Step): JSX.Element {
    const { t } = this.props;
    const { importStep } = this.state;

    return (
      <Steps step={importStep} style={{ marginBottom: 32 }}>
        <Steps.Step
          key='start'
          stepId='start'
          title={t('Start')}
          description={t('Introduction')}
        />
        <Steps.Step
          key='setup'
          stepId='setup'
          title={t('Setup')}
          description={t('Select Mods to import')}
        />
        <Steps.Step
          key='working'
          stepId='working'
          title={t('Import')}
          description={t('Magic happens')}
        />
        <Steps.Step
          key='review'
          stepId='review'
          title={t('Review')}
          description={t('Import result')}
        />
      </Steps>
    );
  }

  private renderContent(step: Step): JSX.Element {
    switch (step) {
      case 'start': return this.renderStart();
      case 'setup': return this.renderSelectMods();
      case 'working': return this.renderWorking();
      case 'review': return this.renderReview();
      case 'wait': return this.renderWait();
      default: return null;
    }
  }

  private renderWait(): JSX.Element {
    return (
      <div className='import-wait-container'>
        <Icon name='spinner' pulse className='page-wait-spinner' />
      </div>
    );
  }

  private renderStart(): JSX.Element {
    const { t } = this.props;
    const { instances } = this.state;

    return (
      <span
        style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-around', height: '100%',
        }}
      >
        {t('This tool is an easy way of transferring your current '
          + 'MO configuration into Vortex.')}
        <div>
          {t('Before you continue, please take note of a few things:')}
          <ul>
            <li>{t('Mods will be copied from MO to Vortex. This may take a while.')}</li>
            <li>{t('Your original MO installation is not modified.')}</li>
            <li>{t('Please make sure you have enough disk space to copy the selected mods.')}</li>
          </ul>
        </div>
        {instances === undefined
          ? <Icon name='spinner' pulse />
          : (
            <div>
              {t('Select a MO2 instance...')}
              {this.renderInstances(instances)}
              {t('... or browse for a MO1 or portable MO2 install')}
              {this.renderBrowse()}
            </div>
          )
        }
      </span>
    );
  }

  private renderInstances(instances: string[]): JSX.Element {
    const { t } = this.props;

    if (instances.length === 0) {
      return (
        <div style={{ marginBottom: 15 }}>
          <span>{t('No global instances')}</span>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 15 }}>
        <DropdownButton
          id='import-select-source'
          title={t('MO2 Instances')}
          onSelect={this.selectSource}
        >
          {instances.map(this.renderSource)}
        </DropdownButton>
      </div>
    );
  }

  private renderBrowse(): JSX.Element {
    const { t } = this.props;
    const { importPath, importPathInvalid } = this.state;
    return (
      <FormGroup validationState={importPathInvalid !== undefined ? 'error' : undefined}>
        <InputGroup>
          <FormControl
            type='text'
            value={importPath}
            onChange={this.setImportPathEvt}
          />
          <InputGroup.Button>
            <tooltip.IconButton
              tooltip={t('Browse')}
              onClick={this.browse}
              icon='folder-open'
            />
          </InputGroup.Button>
        </InputGroup>
        {(importPathInvalid !== undefined)
          ? <ControlLabel>{importPathInvalid}</ControlLabel>
          : null}
      </FormGroup>
    );
  }

  private renderSource = option => {
    return <MenuItem key={option} eventKey={option}>{option}</MenuItem>;
  }

  private renderSelectMods(): JSX.Element {
    const { t } = this.props;
    const { counter, modsToImport, importArchives } = this.state;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Table
          tableId='mo-mods-import'
          data={modsToImport}
          dataId={counter}
          actions={this.mActions}
          staticElements={this.mAttributes}
        />
        <Toggle checked={importArchives} onToggle={this.toggleArchives} style={{ marginTop: 10 }}>
          <a
            className='fake-link'
            title={t('Imports only the archives referenced by imported mods')}
          >
            {t('Import archives')}
          </a>
        </Toggle>
      </div>);
  }

  private renderWorking(): JSX.Element {
    const { t } = this.props;
    const { modsToImport, progress } = this.state;
    if (progress === undefined) {
      return null;
    }

    const perc = Math.floor(progress.perc * 100);
    return (
      <div className='import-working-container'>
        <span>{t('Currently importing: {{mod}}', {replace: { mod: progress.mod }})}</span>
        <ProgressBar now={perc} label={`${perc}%`} />
      </div>
    );
  }

  private renderReview(): JSX.Element {
    const { t } = this.props;
    const { failedImports } = this.state;

    return (
      <div className='import-working-container'>
        {
          failedImports.length === 0
            ? <span className='import-success'><Icon name='check' /> {t('Import successful')}</span>
            : <span className='import-errors'><Icon name='cross' /> {t('There were errors')}</span>
        }
        <span className='import-review-text'>
          {t('You can review the log at')}
          {' '}
          <a onClick={this.openLog}>{this.mTrace.logFilePath}</a>
        </span>
      </div>
    );
  }

  private toggleArchives = () => {
    this.nextState.importArchives = !this.state.importArchives;
  }

  private nextDisabled(): boolean {
    const { error, importPath, importPathInvalid, importStep } = this.state;
    return (error !== undefined)
        || (importStep === 'wait')
        || ((importStep === 'start') && (importPath === undefined))
        || ((importStep === 'start') && (importPathInvalid !== undefined));
  }

  private browse = () => {
    this.context.api.selectDir({})
      .then((dirName: string) => {
        if (dirName !== undefined) {
          this.setImportPath(dirName);
        }
      });
  }

  private setImportPathEvt(evt: React.KeyboardEvent<any>) {
    this.setImportPath(evt.currentTarget.value);
  }

  private setImportPath(newImportPath: string) {
    const { t, discovered, gameId } = this.props;
    this.nextState.importPath = newImportPath;
    this.mUpdatePathDebouncer.schedule();
  }

  private setStep(newStep: Step) {
    this.nextState.importStep = 'wait';

    let job: Promise<void> = Promise.resolve();
    if (newStep === 'start') {
      job = this.start();
    } else if (newStep === 'setup') {
      job = this.setup();
    } else if (newStep === 'working') {
      job = this.startImport();
    } else if (newStep === undefined) {
      this.props.onHide();
    }
    job.then(() => this.nextState.importStep = newStep);
  }

  private openLog = (evt) => {
    evt.preventDefault();
    opn(this.mTrace.logFilePath);
  }

  private nextLabel(step: Step): string {
    const {t} = this.props;
    switch (step) {
      case 'start': return t('Setup');
      case 'setup': return t('Start Import');
      case 'working': return null;
      case 'review': return t('Finish');
      case 'wait': return null;
    }
  }

  private selectSource = eventKey => {
    this.nextState.importPath = path.join(instancesPath(), eventKey);
  }

  private nop = () => undefined;

  private cancel = () => {
    this.props.onHide();
  }

  private next = (): void => {
    const { importStep } = this.state;
    const currentIdx = ImportDialog.STEPS.indexOf(importStep);
    this.setStep(ImportDialog.STEPS[currentIdx + 1]);
  }

  private start(): Promise<void> {
    const { discovered, gameId } = this.props;
    this.nextState.importStep = 'start';
    return findInstances(discovered, gameId)
      .then(found => {
        this.nextState.instances = found;
      });
  }

  private setup(): Promise<void> {
    const { discovered, mods } = this.props;
    const { importPath } = this.state;
    return parseMOIni(discovered, importPath)
      .then(moConfig => {
        this.nextState.importMOConfig = moConfig;
        return readModEntries(moConfig.modPath, mods);
      })
      .then(modEntries => {
        this.nextState.modsToImport = modEntries.reduce((prev, value) => {
          prev[value.modName] = value;
          return prev;
        }, {});
      });
  }

  private isModEnabled(mod: IModEntry): boolean {
    return ((this.state.importEnabled[mod.modName] !== false) &&
          !((this.state.importEnabled[mod.modName] === undefined) && mod.isAlreadyManaged));
  }

  private startImport(): Promise<void> {
    const { t } = this.props;
    const { modsToImport, importArchives, importPath, importMOConfig } = this.state;

    this.mTrace = new TraceImport();

    const modList = Object.keys(modsToImport).map(id => modsToImport[id]);
    const enabledMods = modList.filter(mod => this.isModEnabled(mod));

    this.mTrace.initDirectory(importPath)
      .then(() => importMods(t, this.context.api.store, this.mTrace,
        importMOConfig, enabledMods, importArchives,
        (mod: string, perc: number) => {
          this.nextState.progress = { mod, perc };
        }))
      .then(errors => {
        this.nextState.failedImports = errors;
        this.setStep('review');
      });
    // return immediately because this function is supposed to _start_ the import
    // not _do_ the import
    return Promise.resolve();
  }

  private genActions(): ITableRowAction[] {
    return [
      {
        icon: 'square-check',
        title: 'Enable',
        action: (instanceIds: string[]) => {
          instanceIds.forEach(id => this.nextState.importEnabled[id] = true);
          ++this.nextState.counter;
        },
        singleRowAction: false,
      },
      {
        icon: 'square-empty',
        title: 'Disable',
        action: (instanceIds: string[]) => {
          instanceIds.forEach(id => this.nextState.importEnabled[id] = false);
          ++this.nextState.counter;
        },
        singleRowAction: false,
      },
    ];
  }

  private genAttributes(): Array<types.ITableAttribute<IModEntry>> {
    return [
      {
        id: 'status',
        name: 'Import',
        description: 'The import status of the mod',
        icon: 'level-up',
        calc: mod => this.isModEnabled(mod) ? 'Import' : 'Don\'t import',
        placement: 'table',
        isToggleable: true,
        isSortable: true,
        isVolatile: true,
        edit: {
          inline: true,
          choices: () => [
            { key: 'yes', text: 'Import' },
            { key: 'no', text: 'Don\'t import' },
          ],
          onChangeValue: (modId: string, value: any) => {
            this.nextState.importEnabled[modId] = (value === undefined)
              ? !(this.state.importEnabled[modId] !== false)
              : value === 'yes';
            ++this.nextState.counter;
          },
        },
      },
      {
        id: 'id',
        name: 'Mod id',
        description: 'Nexus id of the mod',
        icon: 'id-badge',
        calc: (mod: IModEntry) => mod.nexusId,
        placement: 'both',
        isToggleable: true,
        isSortable: true,
        isDefaultVisible: false,
        edit: {},
      },
      {
        id: 'name',
        name: 'Mod name',
        description: 'The Name of the mod',
        icon: 'quote-left',
        calc: (mod: IModEntry) => mod.modName,
        placement: 'both',
        isToggleable: true,
        isSortable: true,
        filter: new TableTextFilter(true),
        edit: {},
        sortFunc: (lhs: string, rhs: string, locale: string): number => {
          return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
        },
      },
      {
        id: 'version',
        name: 'Mod Version',
        description: 'The mod version',
        icon: 'map-marker',
        calc: (mod: IModEntry) => mod.modVersion,
        placement: 'both',
        isToggleable: true,
        isSortable: true,
        filter: new TableTextFilter(false),
        sortFunc: (lhs: string, rhs: string, locale: string): number => {
          return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
        },
        edit: {},
      },
      {
        id: 'filename',
        name: 'Mod Archive',
        description: 'The filename of the mod archive',
        icon: 'file-picture-o',
        calc: (mod: IModEntry) => mod.archiveName,
        placement: 'both',
        isToggleable: true,
        isSortable: true,
        isDefaultVisible: false,
        filter: new TableTextFilter(true),
        edit: {},
      },
      {
        id: 'local',
        name: 'Duplicate',
        description: 'Whether the mod is already managed by Vortex',
        icon: 'level-up',
        customRenderer: (mod: IModEntry, detail: boolean, t: I18next.TranslationFunction) => {
          return mod.isAlreadyManaged ? (
            <tooltip.Icon
              id={`import-duplicate-${mod.nexusId}`}
              tooltip={t('This mod is already managed by Vortex')}
              name='triangle-alert'
            />
          ) : null;
        },
        calc: mod => mod.isAlreadyManaged,
        placement: 'table',
        isToggleable: true,
        isSortable: true,
        filter: new TableTextFilter(true),
        edit: {},
      },
    ];
  }
}

function mapStateToProps(state: types.IState): IConnectedProps {
  const gameId = selectors.activeGameId(state);
  return {
    gameId,
    discovered: state.settings.gameMode.discovered,
    mods: state.persistent.mods[gameId],
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<types.IState>): IActionProps {
  return {
  };
}

export default translate([ 'common' ], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(
    ImportDialog)) as React.ComponentClass<{}>;
