declare namespace ReactLayoutPane {
    interface ILayoutProps {
        type: string,
        style?: React.CSSProperties
    }

    export class Layout extends React.Component<ILayoutProps & React.HTMLAttributes<any>, {}> {}
    export class Fixed extends React.Component<React.HTMLAttributes<any>, {}> {}
    export class Flex extends React.Component<React.HTMLAttributes<any>, {}> {}
}

declare module "react-layout-pane" {
    export = ReactLayoutPane
}