/// <reference path="../typings/globals/react/index.d.ts" />

declare namespace ReactSortabelTree {
    export default class SortableTree extends __React.Component<__React.HTMLAttributes, {}> {}
}

declare module "react-sortable-tree" {
    export = ReactSortabelTree
}
