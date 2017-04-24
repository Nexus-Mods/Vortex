import { setOverlayOpen } from '../actions/session';
import { setTabsMinimized } from '../actions/window';

import { IActionDefinition } from '../types/IActionDefinition';
import { IComponentContext } from '../types/IComponentContext';
import { IExtensionApi, IMainPageOptions } from '../types/IExtensionContext';
import { II18NProps } from '../types/II18NProps';
import { IMainPage } from '../types/IMainPage';
import { IState } from '../types/IState';
import { connect, extend } from '../util/ComponentEx';
import { getSafe } from '../util/storeHelper';
import DeveloperType from './Developer';
import Dialog from './Dialog';
import DialogContainer from './DialogContainer';
import DNDContainer from './DNDContainer';
import GlobalOverlay from './GlobalOverlay';
import Icon from './Icon';
import IconBar from './IconBar';
import MainFooter from './MainFooter';
import MainOverlay from './MainOverlay';
import MainPageContainer from './MainPageContainer';
import Notifications from './Notifications';
import QuickLauncher from './QuickLauncher';
import Settings from './Settings';
import { Button, IconButton, NavItem } from './TooltipControls';

import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Modal, Nav } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');

export interface IBaseProps {
  t: I18next.TranslationFunction;
  className: string;
  api: IExtensionApi;
}

export interface IExtendedProps {
  objects: IMainPage[];
}

export interface IMainWindowState {
  showLayer: string;
  showPage: string;
  loadedPages: string[];
}

export interface IConnectedProps {
  tabsMinimized: boolean;
  overlayOpen: boolean;
}

export interface IActionProps {
  onSetTabsMinimized: (minimized: boolean) => void;
  onSetOverlayOpen: (open: boolean) => void;
}

export type IProps = IBaseProps & IConnectedProps & IExtendedProps & IActionProps & II18NProps;

export class MainWindow extends React.Component<IProps, IMainWindowState> {
  // tslint:disable-next-line:no-unused-variable
  public static childContextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  private applicationButtons: IActionDefinition[];

  private settingsPage: IMainPage;

  private pageOverlay: JSX.Element = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
      loadedPages: [],
    };

    this.settingsPage = {
      title: 'Settings',
      group: 'global',
      component: Settings,
      icon: 'sliders',
      propsFunc: () => undefined,
      visible: () =>  true,
    };

    this.applicationButtons = [
    ];
  }

  public getChildContext(): IComponentContext {
    const { api } = this.props;
    return { api };
  }

  public componentWillMount() {
    if (this.props.objects.length > 0) {
      this.setMainPage(this.props.objects[0].title);
    }

    this.props.api.events.on('show-main-page', (title) => {
      this.setMainPage(title);
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
        { this.renderDeveloperModal() }
        <DialogContainer />
      </div>
    );
  }

  private renderToolbar() {
    const {t} = this.props;

    return (
      <Fixed id='main-toolbar'>
        <QuickLauncher t={t} />
        {/*<object id='nexus-logo' data='assets/images/logo.svg' type='image/svg+xml' />*/}
        <IconBar
          group='application-icons'
          staticElements={this.applicationButtons}
        />
        <IconButton
          id='btn-open-flyout'
          icon='ellipsis-v'
          tooltip={t('Functions')}
          onClick={this.toggleOverlay}
          className='pull-right'
        />
      </Fixed>
    );
  }

  private renderBody() {
    const { t, objects, overlayOpen, tabsMinimized } = this.props;
    const { showPage } = this.state;

    const globalPages = objects.filter(page => page.group === 'global');
    const perGamePages = objects.filter(page => page.group === 'per-game');
    const supportPages = objects.filter(page => page.group === 'support');

    const sbClass = tabsMinimized ? 'sidebar-compact' : 'sidebar-expanded';

    const globalOverlay = <GlobalOverlay t={t}/>;

    const pages = objects.map(obj => this.renderPage(obj, globalOverlay));
    pages.push(this.renderPage(this.settingsPage, globalOverlay));

    return (
      <Flex>
        <Layout type='row' style={{ overflowX: 'hidden', overflowY: 'hidden' }}>
          <Fixed id='main-nav-sidebar' className={sbClass}>
            <div id='main-nav-container'>
              <Nav
                bsStyle='pills'
                stacked
                activeKey={showPage}
                onSelect={this.handleSetPage}
                style={{ flexGrow: 1 }}
              >
                {globalPages.map(this.renderPageButton)}
                {this.renderPageButton(this.settingsPage)}
              </Nav>
              <Nav
                bsStyle='pills'
                stacked
                activeKey={showPage}
                onSelect={this.handleSetPage}
                style={{ flexGrow: 1 }}
              >
                {perGamePages.map(this.renderPageButton)}
              </Nav>
              <Nav
                bsStyle='pills'
                stacked
                activeKey={showPage}
                onSelect={this.handleSetPage}
                style={{ flexGrow: 1 }}
              >
                {supportPages.map(this.renderPageButton)}
              </Nav>
            </div>
            <Button
              tooltip={ tabsMinimized ? t('Restore') : t('Minimize') }
              id='btn-minimize-menu'
              onClick={ this.toggleMenu }
              className='btn-menu-minimize'
            >
              <Icon name={ tabsMinimized ? 'angle-double-right' : 'angle-double-left' } />
            </Button>
          </Fixed>
          <Flex id='main-window-pane'>
            <DNDContainer>
              {pages}
            </DNDContainer>
            <MainOverlay pageOverlay={this.pageOverlay} open={overlayOpen} />
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

  /* private renderModalSettings() {
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
  } */

  private renderPageButton = (page: IMainPage) => {
    const { t } = this.props;
    return !page.visible() ? null : (
      <NavItem
        id={page.title}
        key={page.title}
        eventKey={page.title}
        tooltip={t(page.title)}
        placement='right'
      >
        <Icon name={page.icon} />
        <span className='menu-label'>
          {t(page.title)}
        </span>
      </NavItem>
    );
  }

  private renderPage(page: IMainPage, globalOverlay: JSX.Element) {
    const { loadedPages, showPage } = this.state;

    if (loadedPages.indexOf(page.title) === -1) {
      // don't render pages that have never been opened
      return null;
    }
    return (
      <MainPageContainer
        key={page.title}
        page={page}
        active={showPage === page.title}
        onSelectOverlay={this.selectOverlay}
      />
    );
  }

  private selectOverlay = (ref) => {
    this.pageOverlay = ref;
  }

  private toggleOverlay = () => {
    this.props.onSetOverlayOpen(!this.props.overlayOpen);
  }

  private handleSetPage = (key) => {
    this.setMainPage(key);
  }

  private hideLayer = () => this.showLayerImpl('');

  private showLayerImpl(layer: string): void {
    if (this.state.showLayer !== '') {
      this.props.api.events.emit('hide-modal', this.state.showLayer);
    }
    this.setState(update(this.state, { showLayer: { $set: layer } }));
  }

  private setMainPage = (title: string) => {
    if (this.state.showPage !== title) {
      this.props.onSetOverlayOpen(false);
      this.selectOverlay(null);
    }
    // set the page as "loaded", set it as the shown page next frame.
    // this way it gets rendered as hidden once and can then "transition"
    // to visible
    this.setState(update(this.state, {
      loadedPages: { $push: [ title ] },
    }));
    setImmediate(() => {
      this.setState(update(this.state, {
        showPage: { $set: title },
      }));
    });
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
    overlayOpen: state.session.base.overlayOpen,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetTabsMinimized: (minimized: boolean) => dispatch(setTabsMinimized(minimized)),
    onSetOverlayOpen: (open: boolean) => dispatch(setOverlayOpen(open)),
  };
}

function registerMainPage(instance: MainWindow,
                          icon: string,
                          title: string,
                          component: React.ComponentClass<any> | React.StatelessComponent<any>,
                          options: IMainPageOptions) {
  return {
    icon, title, component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
    group: options.group,
  };
}

export default
  extend(registerMainPage)(
    connect(mapStateToProps, mapDispatchToProps)(MainWindow),
  ) as React.ComponentClass<IBaseProps>;
