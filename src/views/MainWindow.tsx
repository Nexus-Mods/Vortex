import { IComponentContext } from '../types/IComponentContext';
import { IExtensionApi } from '../types/IExtensionContext';
import { IIconDefinition } from '../types/IIconDefinition';
import { IMainPage } from '../types/IMainPage';
import { IState } from '../types/IState';
import { ComponentEx, connect, extend, translate } from '../util/ComponentEx';
import Developer from './Developer';
import Dialog from './Dialog';
import IconBar from './IconBar';
import LoginForm from './LoginForm';
import Notifications from './Notifications';
import Settings from './Settings';
import { Button, NavItem } from './TooltipControls';

import * as React from 'react';
import { Alert, Modal, Nav, Well } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import update = require('react-addons-update');
import Icon = require('react-fontawesome');

interface IBaseProps {
  className: string;
  api: IExtensionApi;
}

interface IExtendedProps {
  objects: IMainPage[];
}

interface IMainWindowState {
  showLayer: string;
  showPage: string;
}

interface IConnectedProps {
    APIKey: string;
}

interface IActionProps {
    onSetAPIKey: (APIKey: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IExtendedProps & IActionProps;

export class MainWindow extends ComponentEx<IProps, IMainWindowState> {
  // tslint:disable-next-line:no-unused-variable
  public static childContextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  private buttonsLeft: IIconDefinition[];
  private buttonsRight: IIconDefinition[];

  constructor(props) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
    };

    this.buttonsLeft = [
    ];

    this.buttonsRight = [
      {
        icon: 'gear',
        title: 'Settings',
        action: () => this.showLayer('settings'),
      },
    ];

    if (Developer !== undefined) {
      this.buttonsRight.push(
        {
          icon: 'wrench',
          title: 'Developer',
          action: () => this.showLayer('developer'),
        }
      );
    }
  }

  public getChildContext(): IComponentContext {
    const { api } = this.props;
    return { api };
  }

  public componentWillMount() {
    if (this.props.objects.length > 0) {
      this.setState(update(this.state, {
        showPage: { $set: this.props.objects[0].title },
      }));
    }
  }

  public render(): JSX.Element {
    return (
      <div>
        <Layout type='column'>
        { this.renderToolbar() }
        { this.renderBody() }
        { this.renderFooter() }
        </Layout>
        <Dialog />
        { this.renderModalSettings() }
        { this.renderModalLogin() }
        { this.renderDeveloperModal() }
      </div>
    );
  }

  private renderToolbar() {
    return (
      <Fixed>
        <IconBar
          group='application-icons'
          staticElements={this.buttonsLeft}
        />
        <IconBar
          group='help-icons'
          className='pull-right'
          staticElements={this.buttonsRight}
        />
      </Fixed>
    );
  }

  private renderBody() {
    const { objects } = this.props;
    const { showPage } = this.state;

    return (
      <Flex>
        <Layout type='row'>
          <Fixed>
            <Nav
              bsStyle='pills'
              stacked
              activeKey={showPage}
              onSelect={this.handleSetPage}
            >
              { objects !== undefined ? objects.map(this.renderPageButton) : null }
            </Nav>
          </Fixed>
          <Flex>
            { this.renderCurrentPage() }
          </Flex>
        </Layout>
        <Notifications id='notifications' />
      </Flex>
    );
  }

  private renderFooter() {
    const { t, APIKey } = this.props;
    return (
      <Fixed>
        <Well bsStyle='slim'>
          <Button
            className='btn-embed'
            id='login-btn'
            tooltip={ t('Login') }
            placement='top'
            onClick={ this.showLoginLayer }
          >
            <Icon name='user' style={{ color: APIKey === '' ? 'red' : 'green' }} />
          </Button>
        </Well>
      </Fixed>
    );
  }

  private renderModalSettings() {
    const { t } = this.props;
    const { showLayer } = this.state;
    return (
      <Modal
        id='modal-settings'
        show={ showLayer === 'settings' }
        onHide={ this.hideLayer }
      >
        <Modal.Header>
          <Modal.Title>{ t('Settings') }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Settings />
        </Modal.Body>
        <Modal.Footer>
          <Button
            tooltip={ t('Close') }
            id='close'
            onClick={ this.hideLayer }
          >
          {t('Close') }
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderModalLogin() {
    const { t } = this.props;
    return (
      <Modal show={this.state.showLayer === 'login'} onHide={ this.hideLayer }>
        <Modal.Header>
          <Modal.Title>
          { t(this.props.APIKey === '' ? 'API Key Validation' : 'User Info') }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <LoginForm onClose={ this.hideLayer } />
        </Modal.Body>
      </Modal>
    );
  }

  private renderPageButton = (page: IMainPage) => {
    return (
      <NavItem
        id={page.title}
        key={page.title}
        eventKey={page.title}
        tooltip={page.title}
        placement='right'
      >
        <Icon name={page.icon} />
      </NavItem>
    );
  }

  private renderCurrentPage = () => {
    let { objects } = this.props;

    const page: IMainPage = objects.find((ele) => ele.title === this.state.showPage);
    if (page !== undefined) {
      return <page.component />;
    } else {
      return <Alert>No content pages</Alert>;
    }
  };

  private handleSetPage = (key) => {
    this.setState(update(this.state, {
      showPage: { $set: key },
    }));
  };

  private showLayer = (layer: string) => this.showLayerImpl(layer);
  private hideLayer = () => this.showLayerImpl('');

  private showLoginLayer = () => this.showLayerImpl('login');

  private showLayerImpl(layer: string): void {
    this.setState(update(this.state, { showLayer: { $set: layer } }));
  }

  private renderDeveloperModal() {
    return Developer === undefined ? null : (
      <Modal
        show={this.state.showLayer === 'developer'}
        onHide={ this.hideLayer }
      >
        <Modal.Header>
          <Modal.Title>Developer</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Developer />
        </Modal.Body>
      </Modal>
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
    return { APIKey: state.account.base.APIKey};
}

function registerMainPage(instance: MainWindow,
                          icon: string,
                          title: string,
                          component: React.ComponentClass<any>) {
  return { icon, title, component };
}

export default
  translate(['common'], { wait: true })(
    extend(registerMainPage)(
      connect(mapStateToProps)(MainWindow)
    )
  ) as React.ComponentClass<IBaseProps>;
