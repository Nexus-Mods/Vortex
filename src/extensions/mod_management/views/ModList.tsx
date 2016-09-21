import { extension } from '../../../util/ExtensionProvider';

import { IAttributeState } from '../types/IAttributeState';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';

import ModRow from './ModRow';

import * as React from 'react';
import { Table } from 'react-bootstrap';
import { connect } from 'react-redux';

interface IProps {
  objects: IModAttribute[];
}

interface IAttributeStateMap {
  [ id: string ]: IAttributeState;
}

interface IConnectedProps {
  mods: IMod[];
  attributeState: IAttributeStateMap;
}

interface ILocalState {
}

class ModList extends React.Component<IProps & IConnectedProps, ILocalState> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { objects, attributeState, mods } = this.props;

    const visibleAttributes: IModAttribute[] = this.visibleAttributes(objects, attributeState);

    return (
      <Table bordered condensed hover>
      <thead>
      <tr>
      { visibleAttributes.map(this.renderHeaderField) }
      </tr>
      </thead>
      <tbody>
      { Object.keys(mods).map((id: string) => <ModRow key={ id } mod={ mods[id] } attributes={ visibleAttributes } />) }
      </tbody>
      </Table>
    );
  }

  private getOrDefault(obj: any, key: any, def: any): any {
    if (key in obj) {
      return obj[key];
    } else {
      return def;
    }
  }

  private visibleAttributes(attributes: IModAttribute[], attributeStates: IAttributeStateMap): IModAttribute[] {
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

function mapStateToProps(state: { mods: IStateMods }): IConnectedProps {
  return {
    mods: state.mods.mods,
    attributeState: state.mods.attributeState,
  };
}

function registerModAttribute(instance: ModList, attribute: IModAttribute) {
    return attribute;
}

export default connect(mapStateToProps)(extension(registerModAttribute)(ModList));
