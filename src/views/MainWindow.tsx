import { II18NProps } from '../types/II18NProps';
import IconBar from './IconBar';
import Settings from './Settings';
import { Button } from './TooltipControls';

import * as React from 'react';
import { Label, Modal, Well } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import update = require('react-addons-update');

interface IMainWindowProps {
    className: string;
}

interface IMainWindowState {
    showLayer: string;
    currentTab: string;
}

class MainWindow extends React.Component<IMainWindowProps & II18NProps, IMainWindowState> {
    constructor() {
        super();
        this.state = {
            showLayer: '',
            currentTab: 'mod',
        };
    }

    public render(): JSX.Element {
        const { t } = this.props;
        return (
            <div>
                <Layout type='column'>
                    <Fixed>
                        <IconBar onShowLayer={ (name) => this.showLayer(name) } />
                    </Fixed>
                    <Flex>
                        <Label>Content area placeholder</Label>
                    </Flex>
                    <Fixed>
                        <Well bsStyle='slim'>Statusbar placeholder</Well>
                    </Fixed>
                </Layout>
                <Modal show={this.state.showLayer === 'settings'} onHide={ () => this.showLayer('') }>
                    <Modal.Header>
                        <Modal.Title>{t('Settings')}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Settings />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button tooltip={t('Close')} id='close' onClick={ () => this.showLayer('') }>
                            {t('Close')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }

    private showLayer(layer: string): void {
        this.setState(update(this.state, { showLayer: { $set: layer } }));
    }
}

export default translate(['common'], { wait: true })(MainWindow);
