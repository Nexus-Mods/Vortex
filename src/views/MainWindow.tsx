import { setTabsMinimized } from '../actions/window';

import { IComponentContext } from '../types/IComponentContext';
import { IExtensionApi, IMainPageOptions } from '../types/IExtensionContext';
import { II18NProps } from '../types/II18NProps';
import { IIconDefinition } from '../types/IIconDefinition';
import { IMainPage } from '../types/IMainPage';
import { IState } from '../types/IState';
import { connect, extend, translate } from '../util/ComponentEx';
import { getSafe } from '../util/storeHelper';
import DeveloperType from './Developer';
import Dialog from './Dialog';
import DialogContainer from './DialogContainer';
import Icon from './Icon';
import IconBar from './IconBar';
import MainFooter from './MainFooter';
import Notifications from './Notifications';
import Settings from './Settings';
import { Button, NavItem } from './TooltipControls';

import * as React from 'react';
import { Alert, Modal, Nav } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');
import ReactCSSTransitionGroup = require('react-addons-css-transition-group');

export interface IBaseProps {
  className: string;
  api: IExtensionApi;
}

export interface IExtendedProps {
  objects: IMainPage[];
}

export interface IMainWindowState {
  showLayer: string;
  showPage: string;
}

export interface IConnectedProps {
  tabsMinimized: boolean;
}

export interface IActionProps {
  onSetTabsMinimized: (minimized: boolean) => void;
}

export type IProps = IBaseProps & IConnectedProps & IExtendedProps & IActionProps & II18NProps;

export class MainWindow extends React.Component<IProps, IMainWindowState> {
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

    if (process.env.NODE_ENV === 'development') {
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

    this.props.api.events.on('show-main-page', (title) => {
      this.setState(update(this.state, {
        showPage: { $set: title },
      }));
    });

    this.props.api.events.on('show-modal', (id) => {
      this.setState(update(this.state, {
        showLayer: { $set: id },
      }));
    });
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
        { this.renderDeveloperModal() }
        <DialogContainer />
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
    const { t, objects, tabsMinimized } = this.props;
    const { showPage } = this.state;

    return (
      <Flex>
        <Layout type='row' style={{ overflowX: 'hidden', overflowY: 'hidden' }}>
          <Fixed>
              <Nav
                bsStyle='pills'
                stacked
                activeKey={showPage}
                onSelect={this.handleSetPage}
              >
                {objects !== undefined ? objects.map(this.renderPageButton) : null}
              </Nav>
            <Button
              tooltip={ tabsMinimized ? t('Restore') : t('Minimize') }
              id='btn-minimize-menu'
              onClick={ this.toggleMenu }
              className='btn-menu-minimize'
            >
              <Icon name={ tabsMinimized ? 'angle-double-right' : 'angle-double-left' } />
            </Button>
          </Fixed>
          <Flex>
            <ReactCSSTransitionGroup
              transitionName='mainpage'
              transitionEnterTimeout={250}
              transitionLeaveTimeout={250}
            >
            { this.renderCurrentPage() }
            </ReactCSSTransitionGroup>
          </Flex>
        </Layout>
        <Notifications id='notifications' />
      </Flex>
    );
  }

  private renderFooter() {
    return (
      <Fixed>
        <MainFooter />
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

  private renderPageButton = (page: IMainPage) => {
    const { t, tabsMinimized } = this.props;
    return !page.visible() ? null :
      <NavItem
        id={page.title}
        key={page.title}
        eventKey={page.title}
        tooltip={t(page.title)}
        placement='right'
      >
        <Icon name={page.icon} />
        {tabsMinimized ? null :
          <span className='menu-label'>
            {t(page.title)}
          </span>
        }
      </NavItem>;
  }

  private renderCurrentPage = () => {
    let { objects } = this.props;

    const page: IMainPage = objects.find((ele) => ele.title === this.state.showPage);
    if (page !== undefined) {
      let props = page.propsFunc();
      return <page.component id={page.title} key={page.title} {...props} />;
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

  private showLayerImpl(layer: string): void {
    this.setState(update(this.state, { showLayer: { $set: layer } }));
  }

  private toggleMenu = () => {
    this.props.onSetTabsMinimized(!this.props.tabsMinimized);
  }

  private renderDeveloperModal() {
    if (process.env.NODE_ENV !== 'development') {
      return null;
    } else {
      const Developer: typeof DeveloperType = require('./Developer').default;
      return Developer === undefined ? null : (
        <Modal
          show={this.state.showLayer === 'developer'}
          onHide={this.hideLayer}
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
}

function trueFunc() {
  return true;
}

function emptyFunc() {
  return {};
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetTabsMinimized: (minimized: boolean) => dispatch(setTabsMinimized(minimized)),
  };
}

function registerMainPage(instance: MainWindow,
                          icon: string,
                          title: string,
                          component: React.ComponentClass<any>,
                          options: IMainPageOptions) {
  return {
    icon, title, component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
  };
}

export default
  translate(['common'], { wait: false })(
    extend(registerMainPage)(
      connect(mapStateToProps, mapDispatchToProps)(MainWindow)
    )
  ) as React.ComponentClass<IBaseProps>;
