import { INI_TWEAKS_PATH, NAMESPACE, OPTIONAL_TWEAK_PREFIX } from '../constants';
import { IExtendedInterfaceProps } from '../types/IExtendedInterfaceProps';

import I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, ControlLabel, Table } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import Select from 'react-select';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ActionDropdown, actions, ComponentEx, FlexLayout, Icon, PureComponentEx, selectors,
         More, types, Usage, util } from 'vortex-api';

import { IINITweak, TweakArray } from '../types/IINITweak';

export interface IBaseProps extends IExtendedInterfaceProps {
  settingsFiles: string[];
  onRefreshTweaks: (modPath: string) => Promise<TweakArray>;
  onAddIniTweak: (modPath: string, settingsFiles: string[]) => Promise<void>;
  onRemoveIniTweak: (modPath: string, tweak: IINITweak) => Promise<void>;
}

interface IConnectedProps {
  modsPath: string;
}

interface IActionProps {
  onSetINITweakEnabled: (gameId: string, modId: string, tweak: string, enabled: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  tweaks: TweakArray;
}

interface ITweakProps {
  t: I18next.TFunction;
  tweaksPath: string;
  fileName: string;
  enabled: boolean;
  onToggle: (fileName: string, enabled: boolean) => void;
  onRemoveTweak: (tweak: IINITweak) => void;
}

class Tweak extends PureComponentEx<ITweakProps, {}> {
  private mStatusActions: types.IActionDefinition[] = [
    {
      icon: 'toggle-enabled',
      title: 'Enabled',
      action: () => this.disable(),
      condition: () => this.props.enabled,
    },
    {
      icon: 'toggle-disabled',
      title: 'Disabled',
      action: () => this.enable(),
      condition: () => !this.props.enabled,
    },
    {
      icon: 'delete',
      title: 'Remove',
      action: () => this.remove(),
    },
  ];

  public render(): JSX.Element {
    const { t, fileName } = this.props;
    const match = fileName.match(/(.*)\[(.*)\]\.ini/);

    if (!match || (match.length < 3)) {
      return null;
    }

    return (
      <tr>
        <td className='cell-status'>{this.renderStatusActions()}</td>
        <td className='cell-tweak-name'>{match[1]}</td>
        <td className='cell-filename'>{`${match[2]}.ini`}</td>
        <td className='cell-edit'><a onClick={this.edit}><Icon name='edit' /></a></td>
      </tr>
    );
  }

  private renderStatusActions(): JSX.Element {
    const { t } = this.props;
    return (
      <ActionDropdown
        t={t}
        buttonType='text'
        staticElements={this.mStatusActions}
        className='collections-ini-tweaks-actions'
      />
    );
  }

  private edit = () => {
    const { tweaksPath, fileName } = this.props;
    util.opn(path.join(tweaksPath, fileName)).catch(() => null)
  }

  private enable = () => {
    this.toggle(true);
  }

  private disable = () => {
    this.toggle(false);
  }

  private remove = () => {
    const { fileName, onRemoveTweak } = this.props;
    onRemoveTweak({ fileName });
  }

  private toggle = (enabled: boolean) => {
    const { fileName, onToggle } = this.props;
    onToggle(fileName, enabled);
  }
}

class TweakList extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      tweaks: [],
    });
  }

  public componentDidMount() {
    this.refreshTweaks();
  }

  public render(): JSX.Element {
    const { t, collection } = this.props;
    const { tweaks } = this.state;

    if (collection === undefined) {
      return null;
    }

    return (
      <FlexLayout type='column' className='ini-tweaks-container'>
        <ControlLabel>
          <p>
            {t('This screen lets you set up tweaks for the game ini file that will be applied '
              + 'to a user\'s setup when they use your collection.')}
          </p>
          <p>
            {t('Users can toggle these ini tweaks individually so you may want to set up '
              + 'multiple tweaks to give users granular control.')}
          </p>
        </ControlLabel>
        <FlexLayout.Flex>
          <div id='collection-initweaks-table-panel'>
            <Table id='collection-initweaks-table'>
              <thead>
                <tr>
                  <th className='header-status'>{t('Status')}</th>
                  <th className='header-tweak-name'>{t('Tweak Name')}</th>
                  <th className='header-filename'>{t('Ini File')}</th>
                  <th className='header-edit'>
                      {t('Edit')}
                      <More id='edit-ini-file' name={t('Edit Ini File')}>
                      {t('"Edit" allows you to input the ini tweak you want to '
                       + 'apply to the target ini file. Please provide the section as '
                       + 'well as your tweak(s). e.g.:\n\n[General]\nsIntroSequence=0')}
                      </More>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tweaks.map(tweak => this.renderTweak(tweak))}
              </tbody>
            </Table>
            <Button onClick={this.addIniTweak}>
              {t('Add')}
            </Button>
          </div>
        </FlexLayout.Flex>
        <Usage infoId='ini-tweaks'>
          <p>
            {t('To assist in the testing of INI configuration application - any enabled INI modification '
             + 'on this page will be applied to your own environment in the next deployment event; IF '
             + 'the collection mod is enabled.')}
          </p>
          <p>
            {t('To disable/enable an INI tweak, simply click on the button itself (in the status column). '
             + 'If needed, INI tweak can be removed by clicking the arrow next to the button and selecting "Remove"')}
          </p>
        </Usage>
      </FlexLayout>
    );
  }

  private addIniTweak = () => {
    const { collection, modsPath, onAddIniTweak, settingsFiles } = this.props;
    if (collection?.installationPath && modsPath) {
      const modPath = path.join(modsPath, collection.installationPath);
      onAddIniTweak(modPath, settingsFiles)
        .then(() => this.refreshTweaks());
    }
  }

  private refreshTweaks = () => {
    const { collection, modsPath, onRefreshTweaks } = this.props;
    if (collection?.installationPath && modsPath) {
      const modPath = path.join(modsPath, collection.installationPath);
      onRefreshTweaks(modPath).then((newTweaks) => this.nextState.tweaks = newTweaks);
    }
  }

  private renderTweak = (tweak: IINITweak): JSX.Element => {
    const { t, collection, modsPath } = this.props;
    const { fileName } = tweak;
    const isEnabled = util.getSafe(collection, ['enabledINITweaks'], []).indexOf(fileName) !== -1;
    return (
      <Tweak
        t={t}
        key={`tweak-${fileName}`}
        tweaksPath={path.join(modsPath, collection.installationPath, INI_TWEAKS_PATH)}
        fileName={fileName}
        enabled={isEnabled}
        onToggle={this.toggle}
        onRemoveTweak={this.removeTweak}
      />);
  }

  private removeTweak = (tweak: IINITweak) => {
    const { collection, modsPath, onRemoveIniTweak } = this.props;
    if (collection?.installationPath && modsPath) {
      const modPath = path.join(modsPath, collection.installationPath);
      onRemoveIniTweak(modPath, tweak)
        .then(() => this.refreshTweaks());
    }
  }

  private toggle = (fileName: string, enabled: boolean) => {
    const { collection, gameId, onSetINITweakEnabled } = this.props;
    onSetINITweakEnabled(gameId, collection.id, fileName, enabled);
  }
}

function mapStateToProps(state: types.IState, ownProps: IExtendedInterfaceProps): IConnectedProps {
  return {
    modsPath: selectors.installPath(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<types.IState, null, Redux.Action>)
    : IActionProps {
  return {
    onSetINITweakEnabled:
    (gameId: string, modId: string, tweak: string, enabled: boolean) => {
      dispatch(actions.setINITweakEnabled(gameId, modId, tweak, enabled));
    },
  };
}

const TweakListConnected = withTranslation([NAMESPACE, 'common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    TweakList) as any) as React.ComponentType<IBaseProps>;

export default TweakListConnected;
