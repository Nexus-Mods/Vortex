declare namespace ReactLayoutPane {
    interface ILayoutProps {
        type: string,
        style?: React.CSSProperties
    }

    export class Layout extends React.Component<ILayoutProps & React.HTMLAttributes<{}>, {}> {}
    export class Fixed extends React.Component<React.HTMLAttributes<{}>, {}> {}
    export class Flex extends React.Component<React.HTMLAttributes<{}>, {}> {}
}

declare module "react-layout-pane" {
    export = ReactLayoutPane
}