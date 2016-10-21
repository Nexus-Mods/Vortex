import { IState } from '../types/IState';
import { ComponentEx, connect, extend, translate } from '../util/ComponentEx';

import { Button } from './TooltipControls';

import * as React from 'react';
import { Well } from 'react-bootstrap';
import Icon = require('react-fontawesome');

interface IBaseProps {
  onShowDialog: (name: string) => void;
}

interface IConnectedProps {
  APIKey: string;
}

interface IComponentState {
  showLayer: string;
}

interface IFooter {
  id: string;
  component: React.ComponentClass<any>;
}

interface IExtendedProps {
  objects: IFooter[];
}

type IProps = IBaseProps & IConnectedProps & IExtendedProps;

class MainFooter extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    const { t, APIKey, objects } = this.props;
    return (
      <Well bsStyle='slim'>
        <Button
          className='btn-embed'
          id='login-btn'
          tooltip={t('Login')}
          placement='top'
          onClick={this.showLoginLayer}
        >
          <Icon name='user' style={{ color: APIKey === '' ? 'red' : 'green' }} />
        </Button>

        { objects.map((obj: IFooter) => <obj.component key={ obj.id } />) }
      </Well>
    );
  }

  private showLoginLayer = () => {
    this.props.onShowDialog('login');
  }
}

function mapStateToProps(state: IState): IConnectedProps {
    return { APIKey: state.account.base.APIKey};
}

function registerFooter(instance: MainFooter, id: string, component: React.ComponentClass<any>) {
  return { id, component };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps)(
      extend(registerFooter)(MainFooter)
    )
  ) as React.ComponentClass<IBaseProps>;
