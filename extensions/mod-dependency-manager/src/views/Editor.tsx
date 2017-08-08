import renderModName from '../util/renderModName';

import { closeDialog, setType } from '../actions';

import * as minimatch from 'minimatch';
import { IReference, IRule, RuleType } from 'modmeta-db';
import { actions, ComponentEx, FormFeedbackAwesome, More, types, util } from 'nmm-api';
import * as React from 'react';
import { Button, Col, ControlLabel, Form, FormControl, FormGroup, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as semver from 'semver';

interface IDialog {
  gameId: string;
  modId: string;
  reference: IReference;
  type: RuleType;
}

interface IConnectedProps {
  dialog: IDialog;
  mod: types.IMod;
}

interface IActionProps {
  onCloseDialog: () => void;
  onSetType: (type: RuleType) => void;
  onAddRule: (gameId: string, modId: string, rule: IRule) => void;
}

interface IComponentState {
  type: RuleType;
  reference: IReference;
}

type IProps = IConnectedProps & IActionProps;

/**
 * simple dialog to set dependency rules between two mods
 *
 * @class Editor
 * @extends {ComponentEx<IProps, IComponentState>}
 */
class Editor extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({ type: undefined, reference: undefined });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.dialog !== nextProps.dialog) {
      if (nextProps.dialog !== undefined) {
        this.nextState.type = nextProps.dialog.type;
        this.nextState.reference = {
          ...nextProps.dialog.reference,
          versionMatch: '^' + nextProps.dialog.reference.versionMatch,
        };
      } else {
        this.nextState.type = undefined;
        this.nextState.reference = undefined;
      }
    }
  }

  public render(): JSX.Element {
    const { t, dialog, mod } = this.props;
    const { reference, type } = this.state;

    return (
      <Modal show={dialog !== undefined} onHide={this.close}>
        {dialog !== undefined
          ? (
            <Modal.Body>
              {this.renderSource(mod)}
              <FormControl
                componentClass='select'
                onChange={this.changeType}
                value={type}
                style={{ marginTop: 20, marginBottom: 20 }}
              >
                <option value='before'>{t('Must load before')}</option>
                <option value='after'>{t('Must load after')}</option>
                <option value='requires'>{t('Requires')}</option>
                <option value='conflicts'>{t('Can\'t be loaded together with')}</option>
              </FormControl>
              {this.renderReference(reference)}
            </Modal.Body>
          ) : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t('Cancel')}</Button>
          <Button onClick={this.save}>{t('Save')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderSource = (mod: types.IMod) => {
    return <p>{renderModName(mod)}</p>;
  }

  private renderReference = (reference: IReference): JSX.Element => {
    const {t, dialog} = this.props;
    const {logicalFileName, versionMatch, fileExpression, fileMD5} = reference;

    if (((logicalFileName === '') && (fileExpression === ''))
       || (dialog.reference.versionMatch === undefined)) {
      return (
        <Form horizontal>
          <FormGroup>
            <Col sm={3} componentClass={ControlLabel}>{t('MD5')}</Col>
            <Col sm={9}>
              <FormControl
                type='text'
                value={fileMD5}
                readOnly={true}
              />
            </Col>
          </FormGroup>
        </Form>);
    }

    let expressionInvalid = null;
    if (logicalFileName === undefined) {
      expressionInvalid = minimatch(dialog.reference.fileExpression, fileExpression)
        ? null : t('Doesn\'t match the file name');
    }

    const nameLabel = logicalFileName !== undefined
      ? <Col sm={3} componentClass={ControlLabel}>{t('Name')}</Col>
      : (
        <Col sm={3} componentClass={ControlLabel}>
          {t('Name matching')}
          <More id='more-namematch-editor' name={t('Name matching')}>
            {util.getText('mod', 'namematch', t)}
          </More>
        </Col>
      );

    const versionInvalid =
      (semver.validRange(versionMatch) === null) ? t('Range invalid')
      : !semver.satisfies(dialog.reference.versionMatch, versionMatch) ? t('Doesn\'t match the mod')
      : null;

    return (
      <Form horizontal>
        <FormGroup>
          { nameLabel }
          <Col sm={9}>
            <FormGroup
              style={{ marginLeft: 0, marginRight: 0 }}
              validationState={expressionInvalid !== null ? 'error' : 'success'}
            >
              <FormControl
                type='text'
                value={logicalFileName || fileExpression}
                readOnly={logicalFileName !== undefined}
                onChange={this.changeFileExpression}
              />
              <ControlLabel>{expressionInvalid}</ControlLabel>
              <FormFeedbackAwesome />
            </FormGroup>
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={3} componentClass={ControlLabel}>
            {t('Version Match')}
            <More id='more-versionmatch-editor' name={t('Version matching')}>
              {util.getText('mod', 'versionmatch', t)}
            </More>
          </Col>
          <Col sm={9}>
            <FormGroup
              style={{ marginLeft: 0, marginRight: 0 }}
              validationState={versionInvalid !== null ? 'error' : 'success'}
            >
              <FormControl
                type='text'
                value={versionMatch}
                onChange={this.changeVersion}
              />
              <ControlLabel>{versionInvalid}</ControlLabel>
              <FormFeedbackAwesome />
            </FormGroup>
          </Col>
        </FormGroup>
      </Form>
    );
  }

  private changeFileExpression = (evt) => {
    this.nextState.reference.fileExpression = evt.currentTarget.value;
  }

  private changeVersion = (evt) => {
    this.nextState.reference.versionMatch = evt.currentTarget.value;
  }

  private changeType = (evt) => {
    this.nextState.type = evt.currentTarget.value;
  }

  private save = () => {
    const { dialog, onAddRule } = this.props;
    const { reference, type } = this.state;

    let addRef;
    if (reference.versionMatch !== undefined) {
      if (reference.logicalFileName !== undefined) {
        addRef = {
          logicalFileName: reference.logicalFileName,
          versionMatch: reference.versionMatch,
        };
      } else {
        addRef = {
          fileExpression: reference.fileExpression,
          versionMatch: reference.versionMatch,
        };
      }
    } else {
      addRef = { fileMD5: reference.fileMD5 };
    }

    onAddRule(dialog.gameId, dialog.modId, {
      reference: addRef,
      type,
    });

    this.close();
  }

  private close = () => {
    this.props.onCloseDialog();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const dialog: IDialog = state.session.dependencies.dialog;
  const mod = dialog !== undefined
    ? util.getSafe(state, ['persistent', 'mods', dialog.gameId, dialog.modId], undefined)
    : undefined;
  return {
    dialog,
    mod,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onCloseDialog: () => dispatch(closeDialog()),
    onSetType: (type) => dispatch(setType(type)),
    onAddRule: (gameId, modId, rule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
  };
}

export default translate([ 'common' ], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Editor)) as React.ComponentClass<{}>;
