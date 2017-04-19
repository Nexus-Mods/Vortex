declare namespace ReactSortabelTree {
    export default class SortableTree extends React.Component<any, {}> {};
    export class SortableTreeWithoutDndContext extends React.Component<any, {}> {};
    export function defaultGetNodeKey();
    export function addNodeUnderParent(tree);
    export function changeNodeAtPath(tree);
    export function removeNodeAtPath(tree);
    export function toggleExpandedForAll(tree);
}

declare module "react-sortable-tree" {
    export = ReactSortabelTree;
}
