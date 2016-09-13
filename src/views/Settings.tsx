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
        let { t, objects } = this.props;
        return (
            <Tabs id='settings-tab'>
            { objects.map((page) => <Tab key={page.title} title={t(page.title)}><page.component /></Tab>) }
            </Tabs>
        );
    }
}

function registerSettings(instance: Settings, title: string, component: React.ComponentClass<any>): ISettingsPage {
    return { title, component };
}

export default translate(['common'], { wait: true })(extension(registerSettings)(Settings));
