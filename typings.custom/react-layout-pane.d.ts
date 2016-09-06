/// <reference path="../typings/globals/react/index.d.ts" />

declare namespace ReactLayoutPane {
    interface ILayoutProps {
        type: string,
        style?: __React.CSSProperties
    }

    export class Layout extends __React.Component<ILayoutProps, {}> {}
    export class Fixed extends __React.Component<{}, {}> {}
    export class Flex extends __React.Component<{}, {}> {}
}

declare module "react-layout-pane" {
    export = ReactLayoutPane
}