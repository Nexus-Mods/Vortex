import * as React from 'react';
import { Button, FormControl, InputGroup, ListGroup, ListGroupItem } from 'react-bootstrap';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { setGameSearchPaths } from '../../../actions';
import Icon from '../../../controls/Icon';
import Modal from '../../../controls/Modal';
import { IconButton } from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { TFunction } from '../../../util/i18n';

export interface IGameSelectionDialogProps {
  visible: boolean;
  onHide: () => void;
  onScan: (paths: string[]) => void;
  onSelectPath: (basePath: string) => Promise<string>;
}

type IProps = IGameSelectionDialogProps & IConnectedProps & IActionProps & WithTranslation;

function GameSelectionDialog(props: IProps): JSX.Element {
  const { t, onHide, onScan, onSelectPath, onSetSearchPaths, searchPaths, visible } = props;

  const [paths, setPaths] = React.useState(searchPaths);

  const addSearchPath = React.useCallback(() => {
    setPaths([].concat(paths, process.platform === 'win32' ? 'C:' : '/'));
  }, [paths, setPaths]);

  const updateSearchPath = React.useCallback((idx: number, newPath: string) => {
    const temp = paths.slice();
    temp.splice(idx, 1, newPath);
    setPaths(temp);
  }, [paths, setPaths]);

  const removeSearchPath = React.useCallback((remPath: string) => {
    setPaths(paths.filter(iter => iter !== remPath));
  }, [paths, setPaths]);

  const scan = React.useCallback(() => {
    onSetSearchPaths(paths);
    onScan(paths);
    onHide();
  }, [paths, onSetSearchPaths, onScan]);

  return (
    <Modal show={visible} onHide={nop}>
      <Modal.Header>
        <Modal.Title>{t('Select directories to scan')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <PathsList
          t={t}
          onAddSearchPath={addSearchPath}
          onUpdateSearchPath={updateSearchPath}
          onRemoveSearchPath={removeSearchPath}
          onSelectPath={onSelectPath}
          paths={paths}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>{t('Cancel')}</Button>
        <Button onClick={scan}>{t('Scan')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

function mapStateToProps(state: IState) {
  return {
    searchPaths: state.settings.gameMode.searchPaths,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch) {
  return {
    onSetSearchPaths: (paths: string[]) => dispatch(setGameSearchPaths(paths)),
  };
}

type IConnectedProps = ReturnType<typeof mapStateToProps>;
type IActionProps = ReturnType<typeof mapDispatchToProps>;

function nop() {
  // nop
}

interface IPathsListProps {
  t: TFunction;
  paths: string[];
  onAddSearchPath: () => void;
  onUpdateSearchPath: (idx: number, newPath: string) => void;
  onRemoveSearchPath: (remPath: string) => void;
  onSelectPath: (basePath: string) => Promise<string>;
}

function PathsList(props: IPathsListProps) {
  const { t, onAddSearchPath, onSelectPath, onUpdateSearchPath, paths } = props;

  const remove = React.useCallback((evt: React.MouseEvent<any>) => {
    const remPath = evt.currentTarget.getAttribute('data-path');
    props.onRemoveSearchPath(remPath);
  }, [props.onRemoveSearchPath]);

  return (
    <div>
      <ListGroup>
        {paths.map((iter, idx) => (
          <ListGroupItem key={idx} className='game-search-path'>
            <PathInput
              t={t}
              value={iter}
              idx={idx}
              selectPath={onSelectPath}
              updatePath={onUpdateSearchPath}
            />
            <IconButton
              className='btn-embed pull-right'
              tooltip={t('Remove')}
              data-path={iter}
              onClick={remove}
              icon='remove'
            />
          </ListGroupItem>
        ))}
        <ListGroupItem>
          <Button onClick={onAddSearchPath}>
            <Icon name='add'/>
            <div className='button-text'>{t('Add a search path')}</div>
          </Button>
        </ListGroupItem>
      </ListGroup>
    </div>
  );
}

interface IPathInputProps {
  t: TFunction;
  value: string;
  idx: number;
  updatePath: (idx: number, updatedPath: string) => void;
  selectPath: (basePath: string) => Promise<string>;
}

function PathInput(props: IPathInputProps) {
  const { t, value, idx } = props;

  const updatePath = React.useCallback((evt: React.FormEvent<any>) => {
    props.updatePath(idx, evt.currentTarget.value);
  }, [props.updatePath, idx]);

  const selectPath = React.useCallback(async () => {
    const selectedPath = await props.selectPath(value);
    if (selectedPath !== undefined) {
      props.updatePath(idx, selectedPath);
    }
  }, [props.selectPath, props.updatePath]);

  return (
    <InputGroup>
      <FormControl
        type='text'
        value={value}
        onChange={updatePath}
      />
      <InputGroup.Button className='inset-btn'>
        <IconButton
          id='change-tool-path'
          tooltip={t('Change')}
          onClick={selectPath}
          icon='browse'
        />
      </InputGroup.Button>
    </InputGroup>
  );
}

export default withTranslation('default')(
  connect(mapStateToProps, mapDispatchToProps)(
    GameSelectionDialog));
