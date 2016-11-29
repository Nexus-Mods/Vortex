import {setPluginEnabled} from '../actions/plugins';
import {IPluginStates} from '../types/IPluginState';

import ESPFile from 'esptk';
import {ComponentEx, IconBar, log, types, util} from 'nmm-api';
import * as React from 'react';
import update = require('react-addons-update');
import {Checkbox, ControlLabel, FormControl, FormGroup,
        ListGroup, ListGroupItem, Table} from 'react-bootstrap';
import {translate} from 'react-i18next';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import {connect} from 'react-redux';
import * as nodeUtil from 'util';

interface IBaseProps {
}

interface IConnectedProps {
  plugins: IPluginStates;
}

interface IActionProps {
  onSetPluginEnabled: (pluginName: string, enabled: boolean) => void;
}

interface IComponentState {
  selectedPlugin: string;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class PluginList extends ComponentEx<IProps, IComponentState> {
  private staticButtons: types.IIconDefinition[];
  constructor(props) {
    super(props);
    this.state = {
      selectedPlugin: undefined,
    };
    this.staticButtons = [];
  }

  public render(): JSX.Element {
    const { t, plugins } = this.props;
    return (
      <Layout type='column'>
        <Fixed>
          <IconBar
            group='gamebryo-plugin-icons'
            staticElements={this.staticButtons}
            style={{ width: '100%', display: 'flex' }}
          />
        </Fixed>
        <Flex>
          <Layout type='row'>
            <Flex>
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    <th>{t('Enabled')}</th>
                    <th>{t('Name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plugins !== undefined ? Object.keys(plugins).map(this.renderPlugin) : null}
                </tbody>
              </Table>
            </Flex>
            <Fixed>
              {this.renderPluginDetails(this.state.selectedPlugin)}
            </Fixed>
          </Layout>
        </Flex>
      </Layout>
    );
  }

  private renderPlugin = (pluginName: string) => {
    const { plugins } = this.props;
    return (
      <tr
        key={pluginName}
        id={`row-${pluginName}`}
        onClick={this.selectPlugin}
      >
        <td>
          <Checkbox
            id={`checkbox-${pluginName}`}
            checked={plugins[pluginName].enabled}
            onChange={this.togglePlugin}
          />
        </td>
        <td>
          {pluginName}
        </td>
      </tr>
    );
  }

  private selectPlugin = (evt: __React.MouseEvent) => {
    const row = (evt.currentTarget as HTMLTableRowElement);
    this.setState(update(this.state, {
      selectedPlugin: { $set: row.id.split('-').slice(1).join('-') },
    }));
  }

  private togglePlugin = (evt: __React.MouseEvent) => {
    let box = (evt.target as HTMLInputElement);
    let pluginName = box.id.split('-').slice(1).join('-');
    this.props.onSetPluginEnabled(pluginName, box.value === 'on');
  }

  private renderPluginDetails = (pluginName: string) => {
    if (pluginName === undefined) {
      return null;
    }

    const { t, plugins } = this.props;

    let esp = new ESPFile(plugins[pluginName].filePath);

    return (
      <form style={{ minWidth: 300 }}>
        <FormGroup>
          <ControlLabel>{t('Filename')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-filename'
            type='text'
            readOnly={true}
            value={pluginName}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Description')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-description'
            componentClass='textarea'
            readOnly={true}
            value={esp.description}
            rows={6}
          />
          <Checkbox checked={esp.isMaster}>
            { t('Is a master') }
          </Checkbox>
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Author')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-author'
            type='text'
            readOnly={true}
            value={esp.author}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Required Masters')}</ControlLabel>
          <ListGroup>
            { esp.masterList.map((master) => <ListGroupItem key={master}>{master}</ListGroupItem>) }
          </ListGroup>
        </FormGroup>
      </form>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  let profiles = state.gameSettings.profiles;
  return {
    plugins: util.getSafe(profiles, ['profiles', profiles.currentProfile, 'pluginList'], {}),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetPluginEnabled: (pluginName: string, enabled: boolean) =>
      dispatch(setPluginEnabled(pluginName, enabled)),
  };
}

export default
  translate(['common', 'gamebryo-plugin'], {wait: false})(
    connect(mapStateToProps, mapDispatchToProps)(
      PluginList
    )
  ) as React.ComponentClass<IBaseProps>;
