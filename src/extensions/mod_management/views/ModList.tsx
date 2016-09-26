import { ISettings } from '../../../types/IState';

import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';

import { IAttributeState } from '../types/IAttributeState';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';

import ModRow from './ModRow';

import * as React from 'react';
import { Jumbotron, Table } from 'react-bootstrap';

interface IProps {
  objects: IModAttribute[];
}

interface IAttributeStateMap {
  [ id: string ]: IAttributeState;
}

interface IConnectedProps {
  mods: IMod[];
  attributeState: IAttributeStateMap;
  gameMode: string;
}

interface ILocalState {
}

class ModList extends ComponentEx<IProps & IConnectedProps, ILocalState> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { t, objects, attributeState, mods, gameMode } = this.props;

    const visibleAttributes: IModAttribute[] = this.visibleAttributes(objects, attributeState);

    return gameMode === undefined
      ? <Jumbotron>{ t('Please select a game first') }</Jumbotron>
      : (
      <Table bordered condensed hover>
      <thead>
      <tr>
      { visibleAttributes.map(this.renderHeaderField) }
      </tr>
      </thead>
      <tbody>
      { Object.keys(mods).map((id) => { return this.renderModRow(id, visibleAttributes); }) }
      </tbody>
      </Table>
    );
  }

  private renderModRow(id: string, visibleAttributes: IModAttribute[]): JSX.Element {
    return <ModRow key={ id } mod={ this.props.mods[id] } attributes={ visibleAttributes } />;
  }

  private getOrDefault(obj: any, key: any, def: any): any {
    if (key in obj) {
      return obj[key];
    } else {
      return def;
    }
  }

  private visibleAttributes(attributes: IModAttribute[],
                            attributeStates: IAttributeStateMap): IModAttribute[] {
    return attributes.filter((attribute: IModAttribute) => {
      if (attribute.isDetail) {
        return false;
      } else {
        return this.getOrDefault(attributeStates, attribute.id, { enabled: true }).enabled;
      }
    });
  }

  private renderHeaderField = (attribute: IModAttribute): JSX.Element => {
    let { attributeState } = this.props;
    if (this.getOrDefault(attributeState, attribute.id, true)) {
      return <th key={attribute.id}>{attribute.name}</th>;
    } else {
      return null;
    }
  }
}

interface IState {
 settings: { base: ISettings };
 mods: IStateMods;
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mods: state.mods.mods,
    attributeState: state.mods.attributeState,
    gameMode: state.settings.base.gameMode,
  };
}

function registerModAttribute(instance: ModList, attribute: IModAttribute) {
    return attribute;
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps)(
      extend(registerModAttribute)(ModList)
    )
  ) as React.ComponentClass<{}>;
