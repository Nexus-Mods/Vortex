import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import * as React from "react";
import { util } from "vortex-api";

(cytoscape as any).use(coseBilkent);

const MAX_COLUMNS = 5;

export interface IGraphElement {
  title: string;
  class: string;
  connections: string[];
  readonly?: boolean;
}

export interface IGraphSelection {
  source?: string;
  target?: string;
  id?: string;
  readonly?: boolean;
}

export interface IGraphViewProps {
  elements: { [id: string]: IGraphElement };
  className: string;
  style?: any;
  visualStyle: cytoscape.StylesheetJson;
  onContext: (x: number, y: number, selection: IGraphSelection) => void;
}

function san(input: string): string {
  return input.replace(
    /[^a-zA-Z0-9_-]/g,
    (invalid) => `_${invalid.charCodeAt(0)}_`,
  );
}

class GraphView extends React.Component<IGraphViewProps, {}> {
  private mGraph: cytoscape.Core;
  private mLayout: cytoscape.LayoutManipulation;
  private mMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private mLastProps: IGraphViewProps;
  private mEdgeIds: Set<string> = new Set();

  constructor(props: IGraphViewProps) {
    super(props);

    this.mLastProps = props;
  }

  public UNSAFE_componentWillReceiveProps(newProps: IGraphViewProps) {
    if (newProps.elements !== this.mLastProps.elements) {
      const changed = util.objDiff(this.mLastProps.elements, newProps.elements);
      // bit of a hack because we got componentWillReceiveProps trigger twice with the same
      // props which causes an error further down the line as we try to update the graph
      this.mLastProps = newProps;

      const newConnections = [];

      Object.keys(changed).forEach((id) => {
        if (id[0] === "+") {
          // node added
          this.mGraph.add({
            data: {
              id: san(id.slice(1)),
              title: changed[id].title,
              originalId: id.slice(1),
            },
            classes: changed[id].class,
            position: this.mMousePos,
          });
          const connections = changed[id].connections;
          Object.keys(connections || []).forEach((refId) => {
            const from = san(id.slice(1));
            const to = san(connections[refId]);
            newConnections.push({
              data: {
                id: `${to}-to-${from}`,
                source: to,
                sourceOrig: connections[refId],
                target: from,
                targetOrig: id.slice(1),
              },
              classes:
                newProps.elements[id] !== undefined
                  ? newProps.elements[id].class
                  : undefined,
            });
          });
        } else if (id[0] === "-") {
          // node removed
          this.mGraph.remove("#" + san(id.slice(1)));
        } else {
          // updated classes
          const nodeId = san(id);
          if (this.props.elements[id].class !== newProps.elements[id].class) {
            this.mGraph
              .$(`node#${nodeId}, edge[target = "${nodeId}"]`)
              .removeClass(this.props.elements[id].class)
              .addClass(newProps.elements[id].class);
          }
          // node content changed
          Object.keys(changed[id].connections || [])
            .sort((lhs, rhs) => {
              if (lhs[0] !== rhs[0]) {
                return lhs[0] === "-" ? -1 : 1;
              } else {
                return lhs.localeCompare(rhs);
              }
            })
            .forEach((refId) => {
              const from = san(id);
              const to = san(changed[id].connections[refId]);
              const connId = `${to}-to-${from}`;
              if (refId[0] === "-") {
                this.mEdgeIds.delete(connId);
                this.mGraph.remove("#" + connId);
              } else if (refId[0] === "+") {
                newConnections.push({
                  data: {
                    id: connId,
                    source: to,
                    sourceOrig: changed[id].connections[refId],
                    target: from,
                    targetOrig: id,
                  },
                  classes:
                    newProps.elements[id] !== undefined
                      ? newProps.elements[id].class
                      : undefined,
                });
              }
            });
        }
      });

      newConnections.forEach((conn) => {
        if (!this.mEdgeIds.has(conn.data.id)) {
          this.mEdgeIds.add(conn.data.id);
          this.mGraph.add(conn);
        }
      });

      this.mGraph
        .elements()
        .removeClass("cycle-hidden")
        .removeClass("cycle-highlight");
    }
  }

  public layout() {
    this.mLayout.run();
  }

  public highlightCycle(nodeId: string) {
    // we find the cycle by using a pathfinding algorithm
    // Since the algorithms are implemented to stop immediately when start and goal
    // are the same node, we have to identify the nodes reachable from the selection
    // and do a search from each.

    const followers = this.mGraph
      .$(`#${san(nodeId)}`)
      .outgoers()
      .filter((ele) => ele !== undefined && ele.group() === "nodes");

    const firstCycle = followers.reduce((prev, node) => {
      if (node === undefined) {
        return;
      }
      if (prev === undefined) {
        const root = san(node.id());
        const goal = san(nodeId);

        if (
          this.mGraph.getElementById(root).length === 0 ||
          this.mGraph.getElementById(goal).length === 0
        ) {
          throw new Error(`invalid route "${node.id()}" to "${nodeId}"`);
        }

        const path = this.mGraph.elements().aStar({
          root: `#${root}`,
          goal: `#${goal}`,
          directed: true,
        });
        if (path.found) {
          prev = path.path;
        }
      }
      return prev;
    }, undefined);

    if (firstCycle !== undefined) {
      // unhighlight previous cycle if necessary
      this.mGraph
        .elements()
        .addClass("cycle-hidden")
        .removeClass("cycle-highlight");

      // highlight edge to the node from which the cycle starts
      this.mGraph
        .$(`#${san(nodeId)}-to-${san(firstCycle[0].id())}`)
        .removeClass("cycle-hidden")
        .addClass("cycle-highlight");
      // highlight all other edges in the cycle
      firstCycle
        .filter((iter) => iter.group() === "edges")
        .removeClass("cycle-hidden")
        .addClass("cycle-highlight");
    }
  }

  public render(): JSX.Element {
    const { className, style } = this.props;

    return <div ref={this.setRef} className={className} style={style} />;
  }

  private setRef = (ref: HTMLDivElement) => {
    const { elements, visualStyle } = this.props;
    if (ref === null) {
      (this.mGraph as any).off("cxttap", this.handleContext);
      this.mGraph = undefined;
      return;
    }
    this.mGraph = cytoscape({
      container: ref,
      style: visualStyle,
      minZoom: 0.33,
      maxZoom: 2,
      wheelSensitivity: 0.1,
      boxSelectionEnabled: false,
    });
    this.addElements(elements || {});
    this.mGraph.resize();
    this.mGraph.center();
    this.mLayout = this.mGraph.layout({
      name: "cose-bilkent",
      nodeDimensionsIncludeLabels: true,
      randomize: false,
      nodeRepulsion: 9000,
      idealEdgeLength: 500,
    } as any);
    this.mLayout.run();
    (this.mGraph as any).on("cxttap", this.handleContext);
  };

  private handleContext = (evt: cytoscape.EventObject) => {
    let selection;
    if (evt.target.data !== undefined) {
      const data = evt.target.data();
      if (data.title === undefined && data.source === undefined) {
        // an item was hit, but neither a node nor an edge. Probably the edge handle
        return;
      }
      selection =
        data.source !== undefined
          ? {
              source: data.sourceOrig,
              target: data.targetOrig,
              readonly: data.readonly,
            }
          : { id: data.originalId, readonly: data.readonly };
    }
    this.mMousePos = evt.position;
    this.props.onContext(
      evt.renderedPosition.x,
      evt.renderedPosition.y,
      selection,
    );
  };

  private addElements(elements: { [id: string]: IGraphElement }) {
    const width = MAX_COLUMNS;
    const distance = (this.mGraph.width() / width) * 2;
    this.mGraph.add(
      Object.keys(elements).reduce((prev, id: string, idx: number) => {
        const ele = elements[id];
        const row = Math.floor(idx / width);
        const pos = row % 2 === 0 ? idx % width : width - (idx % width);
        prev.push({
          data: {
            id: san(id),
            title: ele.title,
            originalId: id,
            readonly: ele.readonly,
          },
          classes: ele.class,
          position: {
            x: pos * distance,
            y: row * distance + (pos % 2) * (distance / 2),
          },
        });
        (ele.connections || []).forEach((conn) => {
          prev.push({
            data: {
              id: san(`${san(conn)}-to-${san(id)}`),
              target: san(id),
              source: san(conn),
              targetOrig: id,
              sourceOrig: conn,
              readonly: ele.readonly,
            },
            classes: ele.class,
          });
        });
        return prev;
      }, []),
    );
  }
}

export default GraphView;
