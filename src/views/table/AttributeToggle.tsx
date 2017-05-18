import Icon from '../Icon';
import { Button } from '../TooltipControls';

import { IAttributeState } from '../../types/IAttributeState';
import { ITableAttribute } from '../../types/ITableAttribute';

import * as _ from 'lodash';
import * as React from 'react';

function getAttr<T>(state: IAttributeState, key: string, def: T): T {
  if (state === undefined) {
    return def;
  }

  return state[key] !== undefined ? state[key] : def;
}

export interface IAttributeProps {
  attribute: ITableAttribute;
  state: IAttributeState;
  onSetAttributeVisible: (id: string, visible: boolean) => void;
  t: I18next.TranslationFunction;
}

class AttributeToggle extends React.Component<IAttributeProps, {}> {
  public shouldComponentUpdate(nextProps: IAttributeProps) {
    // TODO: compare by content because this is temporary anyway so fixing
    //   isn't worth it
    return !_.isEqual(this.props.state, nextProps.state);
  }

  public render(): JSX.Element {
    const { attribute, state, t } = this.props;

    const cssClass = getAttr(state, 'enabled', true)
      ? 'attribute-icon-enabled'
      : 'attribute-icon-disabled';

    return (
      <Button
        id={attribute.id}
        className='btn-embed'
        tooltip={ t(attribute.name) }
        onClick={ this.toggleAttribute }
      >
        <Icon name={attribute.icon} className={ cssClass } />
      </Button>
    );
  }

  private toggleAttribute = () => {
    const { attribute, state, onSetAttributeVisible } = this.props;
    onSetAttributeVisible(attribute.id, !getAttr(state, 'enabled', true));
  }
}

export default AttributeToggle;
