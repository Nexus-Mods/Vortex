import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { IComponentContext } from '../../../types/IComponentContext';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { addSearchPath, removeSearchPath } from '../actions/settings';
import { IStateEx } from '../types/IStateEx';

import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock, ListGroup, ListGroupItem } from 'react-bootstrap';

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
    let { searchPath, t } = this.props;
    return (
      <ListGroupItem>
        {searchPath}
        <Button
          className='btn-embed pull-right'
          id='remove'
          tooltip={ t('Remove') }
          onClick={ this.removePath }
        >
          <Icon name='remove' />
        </Button>
      </ListGroupItem>
    );
  }

  private removePath = () => {
    let { searchPath, onRemovePath } = this.props;
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

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  public render(): JSX.Element {
    const { searchPaths, t } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>{ t('Search Paths') }</ControlLabel>
          <ListGroup>
          { searchPaths.map(this.renderPath) }
          <ListGroupItem>
            <Button
              className='btn-embed'
              id='add'
              tooltip={ t('Add') }
              onClick={ this.addSearchPath }
            >
              <Icon name='plus' />
            </Button>
          </ListGroupItem>
          </ListGroup>
          <HelpBlock>{ t('Directories to search when looking for games.') }</HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private addSearchPath = () => {
    this.context.api.selectDir({})
    .then((dirName: string) => {
      this.props.onAddPath(dirName);
    })
    .catch((err) => {
      log('info', 'search path selection cancelled', { err });
    });
  }

  private renderPath = (searchPath: string) => {
    let { t, onRemovePath } = this.props;
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

function mapStateToProps(state: IStateEx): IConnectedProps {
  return {
    searchPaths: state.settings.gameMode.searchPaths,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
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
    connect(mapStateToProps, mapDispatchToProps)(Settings)
  ) as React.ComponentClass<{}>;
