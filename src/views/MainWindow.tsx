import * as React from 'react';
import { Label } from 'react-bootstrap';

interface IMainWindowProps {
    className: string;
}

interface IMainWindowState {
}

export class MainWindow extends React.Component<IMainWindowProps, IMainWindowState> {
    public render() {
        return <Label>Hello World</Label>;
    }
}
