import { IExtensionContext, IExtensionProps } from '../types/Extension';
import { II18NProps } from '../types/II18NProps';
import { extension } from '../util/ExtensionProvider';

import * as React from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { translate } from 'react-i18next';

interface ISettingsPage {
    title: string;
    component: React.ComponentClass<any>;
}

class Settings extends React.Component<II18NProps & IExtensionProps, {}> {

    private settingsPages: ISettingsPage[];

    constructor(props) {
        super(props);
        this.state = {
        };

        this.settingsPages = [];

        let context: IExtensionContext = {
            registerSettings: (title: string, component: React.ComponentClass<any>) => {
                this.settingsPages.push({title, component});
            },
            registerReducer: () => true,
        };

        for (let ext of this.props.extensions) {
            ext(context);
        }
    }

    public render(): JSX.Element {
        return (
            <Tabs id='settings-tab'>
            {this.settingsPages.map((page) => <Tab key={page.title} title={page.title}><page.component /></Tab>)}
            </Tabs>
        );
    }
}

export default extension(translate(['common'], { wait: true })(Settings));
