import { II18NProps } from '../types/II18NProps';
import { extension } from '../util/ExtensionProvider';

import * as React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { translate } from 'react-i18next';

interface ISettingsPage {
    title: string;
    component: React.ComponentClass<any>;
}

interface ISettingsProps {
    objects: ISettingsPage[];
}

class Settings extends React.Component<ISettingsProps & II18NProps, {}> {
    constructor(props) {
        super(props);
    }

    public render(): JSX.Element {
        let { objects } = this.props;
        return (
            <Tabs id='settings-tab'>
            { objects.map(this.renderTab) }
            </Tabs>
        );
    }

    private renderTab = (page) => this.renderTabImpl(this.props.t, page);

    private renderTabImpl(t, page): JSX.Element {
        return <Tab key={page.title} eventKey={page.title} title={t(page.title)}><page.component /></Tab>;
    }
}

function registerSettings(instance: Settings, title: string, component: React.ComponentClass<any>): ISettingsPage {
    return { title, component };
}

export default translate(['common'], { wait: true })(extension(registerSettings)(Settings));
