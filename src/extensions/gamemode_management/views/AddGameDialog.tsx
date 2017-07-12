import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { FormCheckboxItem, FormPathItem, FormTextItem } from '../../../views/FormFields';
import More from '../../../views/More';

import { setAddGameDialogVisible } from '../actions/session';
import { addDiscoveredGame } from '../actions/settings';
import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Col, ControlLabel, Form, FormGroup, Modal } from 'react-bootstrap';
import * as rimraf from 'rimraf';
import { generate as shortid } from 'shortid';

interface IConnectedProps {
  visible: boolean;
  knownGames: IGameStored[];
  discovered: { [gameId: string]: IDiscoveryResult };
}

interface IActionProps {
  onCloseDialog: () => void;
  onAddDiscoveredGame: (gameId: string, result: IDiscoveryResult) => void;
}

interface IComponentState {
  game: IDiscoveryResult;
  imgCounter: number;
}

type IProps = IConnectedProps & IActionProps;

function getMergeText(t: I18next.TranslationFunction) {
  return t(
    'Some games expect all mods to be merged into a single directory ' +
    '(the data directory in Skyrim for example) while others neatly ' +
    'place each mod into its own directory. This toggle tells Vortex which ' +
    'of the two groups this game falls into.');
}

/**
 * simple dialog to set userlist rule between two plugins
 *
 * @class Editor
 * @extends {ComponentEx<IProps, IComponentState>}
 */
class AddGameDialog extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean = false;
  constructor(props: IProps) {
    super(props);
    this.initState({ game: undefined, imgCounter: 0 });
  }

  public componentWillMount() {
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (!this.props.visible && nextProps.visible && this.mMounted) {
      this.reset();
    }
  }

  public render(): JSX.Element {
    const { t, visible } = this.props;
    const { game, imgCounter } = this.state;

    if (game === undefined) {
      return null;
    }

    const logoPath = path.join(game.extensionPath, game.logo);

    return (
    <Modal show={visible} onHide={this.close}>
      <Modal.Header>
        <h3>{game.name}</h3>
      </Modal.Header>
      <Modal.Body>
        <p>
          {t('Note: You can add games to Vortex that aren\'t supported out of the box ' +
            'but please don\'t expect more than the most basic functionality.')}
        </p>
        <Form horizontal>
          <FormTextItem
            t={t}
            controlId='formName'
            label={t('Name')}
            placeholder={t('Name')}
            value={game.name}
            stateKey='name'
            onChangeValue={this.setValue}
            validator={this.uniqueName}
          />
          <FormTextItem
            t={t}
            controlId='formShortName'
            label={t('Short Name')}
            placeholder={t('Shorter variant of the name (optional)')}
            value={game.shortName}
            stateKey='shortName'
            onChangeValue={this.setValue}
          />
          <FormPathItem
            t={t}
            controlId='formPath'
            label={t('Game Directory')}
            placeholder={t('Base directory of the game')}
            value={game.path}
            stateKey='path'
            onChangeValue={this.setValue}
            directory={true}
            validator={this.isSet}
          />
          <FormPathItem
            t={t}
            controlId='formExePath'
            label={t('Executable')}
            placeholder={t('Path to the game executable')}
            value={game.executable}
            stateKey='executable'
            onChangeValue={this.setValue}
            directory={false}
            extensions={['exe', 'bat', 'cmd']}
            validator={this.exeValidator}
          />
          <FormPathItem
            t={t}
            controlId='formModPath'
            label={t('Mod Directory')}
            placeholder={t('Directory where Vortex should place mods')}
            value={game.modPath}
            stateKey='modPath'
            onChangeValue={this.setValue}
            directory={true}
            validator={this.isSet}
          />
          <FormGroup>
            <Col sm={3}>
              <ControlLabel>{t('Image')}</ControlLabel>
            </Col>
            <Col sm={9}>
              <div style={{ textAlign: 'center' }}>
                {logoPath !== undefined ? (
                  <img
                    className={'game-thumbnail-img-large'}
                    src={logoPath + '?' + imgCounter}
                    onClick={this.setLogo}
                    id='img-add-game'
                    alt={t('Click to select the image')}
                  />
                ) : null}
              </div>
            </Col>
          </FormGroup>
          <div>
            <FormCheckboxItem
              t={t}
              controlId='formModMerge'
              label={t('Merge Mods')}
              value={game.mergeMods}
              stateKey='mergeMods'
              onChangeValue={this.setCheckboxValue}
              style={{ display: 'inline' }}
            />
            <More id='more-mergemods' name={t('Merging Mods')}>
              {getMergeText(t)}
            </More>
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={this.cancel}>{t('Cancel')}</Button>
        <Button onClick={this.save}>{t('Save')}</Button>
      </Modal.Footer>
    </Modal>
    );
  }

  private setLogo = () => {
    const { extensionPath } = this.state.game;
    remote.dialog.showOpenDialog(null, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg'] },
      ],
    }, (fileNames: string[]) => {
      if (fileNames === undefined) {
        return;
      }
      const ext = path.extname(fileNames[0]);
      const logoName = `logo${ext}`;
      this.nextState.game.logo = logoName;
      fs.ensureDirAsync(extensionPath)
        .then(() => fs.copyAsync(fileNames[0], path.join(extensionPath, logoName)))
        .then(() => {
          this.nextState.imgCounter++;
        });
    });
  }

  private uniqueName = (name: string) => {
    const { t, discovered, knownGames } = this.props;
    if (name === '') {
      return t('Name is required');
    }
    if ((Object.keys(discovered).find(gameId => discovered[gameId].name === name) !== undefined)
      || (knownGames.find(game => game.name === name) !== undefined)) {
      return t('Name has to be unique');
    }
    return null;
  }

  private isSet = (value: string) => {
    const { t } = this.props;
    return value.length > 0 ? null : t('Needs to be set');
  }

  private exeValidator = (value: string) => {
    const { t } = this.props;
    const { game } = this.state;
    if (value.length === 0) {
      return t('Needs to be set');
    }
    if ((game.path === undefined)
      || path.relative(game.path, value).startsWith('..')) {
      return t('Executable needs to be inside game directory');
    }
    return null;
  }

  private setValue = (key: string, value: any) => {
    this.nextState.game[key] = value;
  }

  private setCheckboxValue = (key: string, value) => {
    this.setValue(key, value === 'on');
  }

  private reset = () => {
    const id = shortid();
    this.nextState.game = {
      id,
      extensionPath: path.join(remote.app.getPath('userData'), id),
      logo: 'logo.png',
    };
  }

  private save = () => {
    const result = { ...this.state.game };
    result.executable = path.relative(result.path, result.executable);
    this.props.onAddDiscoveredGame(result.id, result);
    this.close();
  }

  private cancel = () => {
    const { extensionPath } = this.state.game;
    rimraf(extensionPath, (err: Error) => {
      if (err !== null) {
        log('error', 'failed to clean up temporary dir',
          { extensionPath, err: err.message });
      }
      this.close();
    });
  }

  private close = () => {
    this.reset();
    this.props.onCloseDialog();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    visible: state.session.gameMode.addDialogVisible,
    knownGames: state.session.gameMode.known,
    discovered: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredGame: (gameId: string, result: IDiscoveryResult) =>
      dispatch(addDiscoveredGame(gameId, result)),
    onCloseDialog: () => dispatch(setAddGameDialogVisible(false)),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(AddGameDialog)) as React.ComponentClass<{}>;
