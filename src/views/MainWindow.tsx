import { II18NProps } from '../types/II18NProps';
import { IIconDefinition } from '../types/IIconDefinition';
import { IMainPage } from '../types/IMainPage';
import { extension } from '../util/ExtensionProvider';
import Dialog from './Dialog';
import IconBar from './IconBar';
import LoginForm from './LoginForm';
import Notifications from './Notifications';
import Settings from './Settings';
import { Button } from './TooltipControls';
import { connect } from 'react-redux';
import * as React from 'react';
import { Alert, Modal, Nav, NavItem, Well } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import { setLoggedInUser } from '../actions/account';
import update = require('react-addons-update');
import Icon = require('react-fontawesome');

import Developer from './Developer';

interface IMainWindowProps {
  className: string;
  objects: IMainPage[];
}

interface IMainWindowState {
  showLayer: string;
  showPage: string;
}

interface IMainWindowConnectedProps {
    username: string;
    sid: string;
}

interface IMainWindowActionProps {
    onSetAccount: (username: string, sid: string) => void;
}

class MainWindowBase extends React.Component<IMainWindowProps & IMainWindowConnectedProps & IMainWindowActionProps & II18NProps, IMainWindowState> {

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
      { icon: 'gear', title: 'Settings', action: () => this.showLayer('settings') },
    ];
    
    if (Developer !== undefined) {
      this.buttonsRight.push(
        { icon: 'wrench', title: 'Developer', action: () => this.showLayer('developer') }
      );
    }
  }

  public componentWillMount() {
    this.setState(update(this.state, { showPage: { $set: this.props.objects[0].title } }));
  }

  public render(): JSX.Element {
    const { t, objects } = this.props;
    const { showPage } = this.state;
    return (
      <div>
        <Layout type='column'>
          <Fixed>
            <IconBar group='application-icons' staticElements={this.buttonsLeft} />
            <IconBar group='help-icons' className='pull-right' staticElements={this.buttonsRight} />
          </Fixed>
          <Flex>
            <Layout type='row'>
              <Fixed>
                <Nav bsStyle='pills' stacked activeKey={showPage} onSelect={this.handleSetPage}>
                  {objects.map(this.renderPageButton) }
                </Nav>
              </Fixed>
              <Flex>
                {this.renderCurrentPage()}
              </Flex>
            </Layout>
            <Notifications id='notifications' />
          </Flex>
          <Fixed>
            <Well bsStyle='slim'>
                          <Button
                              className='btn-embed'
                              id='login-btn'
                              tooltip={ t('Login') }
                              onClick={(this.props.sid == '' || this.props.sid == null) ? this.showLoginLayer : this.setAccount}>
                              <Icon name='user' style={{ color: this.props.sid === "" ? 'red' : 'green' }} />
              </Button>
              <span>{this.props.username === "undefined" ? ' guest' : ' ' + this.props.username}</span>
            </Well>
          </Fixed>
        </Layout>
        <Dialog />
        <Modal show={this.state.showLayer === 'settings'} onHide={ this.hideLayer }>
          <Modal.Header>
            <Modal.Title>{ t('Settings') }</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Settings />
          </Modal.Body>
          <Modal.Footer>
            <Button tooltip={ t('Close') } id='close' onClick={ this.hideLayer }>
              {t('Close') }
            </Button>
          </Modal.Footer>
        </Modal>
        <Modal show={this.state.showLayer === 'login'} onHide={ this.hideLayer }>
          <Modal.Header>
            <Modal.Title>{ t('Login') }</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <LoginForm onClose={ this.hideLayer } />
          </Modal.Body>
        </Modal>
        { this.renderDeveloperModal() }
      </div>
    );
  }

  private setAccount = () => {
      let { onSetAccount} = this.props;
      onSetAccount('undefined', '');
  }

  private renderPageButton = (page: IMainPage) => {
    return <NavItem key={page.title} eventKey={page.title}><Icon name={page.icon} /></NavItem>;
  }

  private renderCurrentPage = () => {
    const page: IMainPage = this.props.objects.find(
      (ele) => ele.title === this.state.showPage);
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
      <Modal show={this.state.showLayer === 'developer'} onHide={ this.hideLayer }>
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

function mapStateToProps(state: any): IMainWindowConnectedProps {
    return { username: state.account.account.username, sid: state.account.account.cookie};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IMainWindowActionProps {
    return {
        onSetAccount: (username: string, sid: string) => dispatch(setLoggedInUser(username, sid)),
    };
}

const MainWindow = connect(mapStateToProps, mapDispatchToProps)(MainWindowBase) as React.ComponentClass<IMainWindowProps & IMainWindowConnectedProps>;

function registerMainPage(instance: MainWindowBase, icon: string, title: string, component: React.ComponentClass<any>) {
  return { icon, title, component };
}

export default translate(['common'], { wait: true })(extension(registerMainPage)(MainWindow));
