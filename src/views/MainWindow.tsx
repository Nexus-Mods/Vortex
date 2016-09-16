import { II18NProps } from '../types/II18NProps';
import { IIconDefinition } from '../types/IIconDefinition';
import Dialog from './Dialog';
import IconBar from './IconBar';
import LoginForm from './LoginForm';
import Notifications from './Notifications';
import Settings from './Settings';
import { Button } from './TooltipControls';

import * as React from 'react';
import { Label, Modal, Well } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import update = require('react-addons-update');
import Icon = require('react-fontawesome');

import Developer from './Developer';

/*
let Developer = undefined;
if (process.env.NODE_ENV === 'development') {
  // tslint:disable-next-line:no-var-requires
  Developer = require('./Developer').default;
}*/

interface IMainWindowProps {
  className: string;
}

interface IMainWindowState {
  showLayer: string;
}

class MainWindow extends React.Component<IMainWindowProps & II18NProps, IMainWindowState> {

  private buttonsLeft: IIconDefinition[];
  private buttonsRight: IIconDefinition[];

  constructor(props) {
    super(props);

    this.state = {
      showLayer: '',
    };

    this.buttonsLeft = [
      { icon: 'bank', title: 'placeholder', action: () => undefined },
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

  public render(): JSX.Element {
    const { t } = this.props;
    return (
      <div>
        <Layout type='column'>
          <Fixed>
            <IconBar group='application-icons' staticElements={this.buttonsLeft} />
            <IconBar group='help-icons' className='pull-right' staticElements={this.buttonsRight} />
          </Fixed>
          <Flex>
            <Label>Content area placeholder</Label>
            <Notifications id='notifications' />
          </Flex>
          <Fixed>
            <Well bsStyle='slim'>
              <Button
                className='btn-embed'
                id='login-btn'
                tooltip={ t('Login') }
                onClick={ this.showLoginLayer }
              >
                <Icon name='user'/>
              </Button>
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

export default translate(['common'], { wait: true })(MainWindow);
