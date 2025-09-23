import * as _ from 'lodash';
import * as React from 'react';
import { Panel } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import { actions, ComponentEx, FlexLayout, log, MainPage,
         Spinner, tooltip, types, util } from 'vortex-api';

import NexusWebView from './NexusWebView';

const NEXUS_HOME_URL = 'https://www.nexusmods.com';

interface IComponentState {
  loading: boolean;
}

interface IActionProps {
  onShowDialog: (type: types.DialogType, title: string, content: types.IDialogContent,
    actions: types.DialogActions) => void;
}

type IProps = IActionProps;

class BrowseNexus extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;

  constructor(props: IProps) {
    super(props);
    this.initState({
      loading: false
    });
  }

  public componentDidMount() {
    this.mMounted = true;
    //this.context.api.events.on('navigate-knowledgebase', this.navigate);
  }

  public componentWillUnmount() {
    //this.context.api.events.removeListener('navigate-knowledgebase', this.navigate);
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t } = this.props;

    return (
      <MainPage>
        <MainPage.Body>
          <FlexLayout type='column' className='documentation'>
            <Panel>
              <Panel.Body style={{ padding: 0, height: '100%' }}>
                <NexusWebView initialUrl={NEXUS_HOME_URL} />
              </Panel.Body>
            </Panel>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

}

function mapStateToProps(state: types.IState): any {
  return {};
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    withTranslation(['common'])(BrowseNexus as any) as React.ComponentClass<IProps>);

