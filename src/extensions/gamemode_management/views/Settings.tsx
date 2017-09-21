import Icon from '../../../controls/Icon';
import { IconButton } from '../../../controls/TooltipControls';
import { IComponentContext } from '../../../types/IComponentContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { isNullOrWhitespace } from '../../../util/util';

import { addSearchPath, removeSearchPath } from '../actions/settings';

import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock, ListGroup, ListGroupItem } from 'react-bootstrap';
import * as Redux from 'redux';

import { log } from '../../../util/log';

interface IPathProps {
  searchPath: string;
  t: (input: string) => string;
  onRemovePath: (path: string) => void;
}

/**
 * entry of the game search path list
 *
 * @class SearchPathEntry
 * @extends {ComponentEx<IPathProps, {}>}
 */
class SearchPathEntry extends ComponentEx<IPathProps, {}> {
  public render() {
    const { searchPath, t } = this.props;
    return (
      <ListGroupItem>
        <span>{searchPath}</span>
        <IconButton
          className='btn-embed'
          id='remove'
          tooltip={t('Remove')}
          onClick={this.removePath}
          icon='remove'
        />
      </ListGroupItem>
    );
  }

  private removePath = () => {
    const { searchPath, onRemovePath } = this.props;
    onRemovePath(searchPath);
  }
}

interface IConnectedProps {
  searchPaths: string[];
}

interface IActionProps {
  onAddPath: (path: string) => void;
  onRemovePath: (path: string) => void;
}

/**
 * settings dialog for game modes
 * Contains the list of paths to search when looking for installed games
 *
 * @class Settings
 * @extends {(ComponentEx<IActionProps & IConnectedProps, {}>)}
 */
class Settings extends ComponentEx<IActionProps & IConnectedProps, {}> {
  public context: IComponentContext;

  public render(): JSX.Element {
    const { searchPaths, t } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>{t('Search Paths')}</ControlLabel>
          <ListGroup className='list-game-search'>
            {searchPaths.sort().map(this.renderPath)}
            <ListGroupItem>
              <IconButton
                className='btn-embed'
                id='add'
                tooltip={t('Add')}
                onClick={this.addSearchPath}
                icon='plus'
              />
            </ListGroupItem>
          </ListGroup>
          <HelpBlock>{t('Directories to search when looking for games.')}</HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private addSearchPath = () => {
    this.context.api.selectDir({})
    .then((dirName: string) => {
      if (!isNullOrWhitespace(dirName)) {
        this.props.onAddPath(dirName);
      }
    })
    .catch((err) => {
      log('info', 'search path selection cancelled', { err });
    });
  }

  private renderPath = (searchPath: string) => {
    const { t, onRemovePath } = this.props;
    return (
      <SearchPathEntry
        key={searchPath}
        searchPath={searchPath}
        t={t}
        onRemovePath={onRemovePath}
      />
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    // search paths should be initialized immediately on first start but this can't hurt
    searchPaths: state.settings.gameMode.searchPaths || [],
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddPath: (path: string): void => {
      dispatch(addSearchPath(path));
    },
    onRemovePath: (path: string): void => {
      dispatch(removeSearchPath(path));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      Settings)) as React.ComponentClass<{}>;
