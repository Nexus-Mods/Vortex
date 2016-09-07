import { IconBar } from './IconBar';
import { Button } from './TooltipControls';

import * as React from 'react';
import { Label, Modal, Well } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');

interface IMainWindowProps {
    className: string;
}

interface IMainWindowState {
    showLayer: string;
    currentTab: string;
}

export class MainWindow extends React.Component<IMainWindowProps, IMainWindowState> {
    constructor() {
        super();
        this.state = {
            showLayer: '',
            currentTab: 'mod',
        };
    }

    public render() {
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
                        <Well bsStyle='slim'>Footer placeholder</Well>
                    </Fixed>
                </Layout>
                <Modal show={this.state.showLayer === 'settings'} onHide={() => { this.showLayer(''); }}>
                    <Modal.Header>
                        <Modal.Title>Settings</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Label>Settings placeholder</Label>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button tooltip='Close' onClick={() => { this.showLayer(''); }}>Close</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }

    private showLayer(layer: string): void {
        this.setState(update(this.state, { showLayer: { $set: layer } }));
    }
}
