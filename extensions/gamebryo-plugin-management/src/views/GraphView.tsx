import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import edgehandles from 'cytoscape-edgehandles';
import * as React from 'react';
import { util } from 'vortex-api';

(cytoscape as any).use(edgehandles);
(cytoscape as any).use(coseBilkent);

const MAX_COLUMNS = 10;

export interface IConnectionGroup {
  class: string;
  connections: string[];
}

export interface IGraphElement {
  title: string;
  class: string;
  connections: IConnectionGroup[];
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
  visualStyle: any[];
  onConnect: (source: string, target: string) => void;
  onDisconnect: (source: string, target: string) => void;
  onRemove: (id: string) => void;
  onContext: (x: number, y: number, selection: IGraphSelection) => void;
}

function san(input: string): string {
  let res = input.replace(/[^a-zA-Z0-9_-]/g, (invalid) => `_${invalid.charCodeAt(0)}_`);
  if (!res) {
    // workaround so we can open the dialog even with an empty node name
    res = '__empty';
  }
  return res;
}

class GraphView extends React.Component<IGraphViewProps, {}> {
  private mGraph: cytoscape.Core;
  private mLayout: cytoscape.LayoutManipulation;
  private mEdgeHandler: any;
  private mMousePos: { x: number, y: number } = { x: 0, y: 0 };
  private mHoveredNode: any;
  private mRecentlyCreatedEdges: Set<string> = new Set();
  private mIsHandlingEdgeCreation: boolean = false;

  public componentDidUpdate(prevProps: IGraphViewProps) {
    if (!this.mGraph) return;
    if (prevProps.elements === this.props.elements) return;
    if (this.mIsHandlingEdgeCreation) return;

    const elements = this.props.elements;
    let needsLayout = false;

    // Sync nodes
    Object.keys(elements).forEach(id => {
      const node = elements[id];
      const nodeId = san(id);
      const existing = this.mGraph!.getElementById(nodeId);
      if (existing.empty()) {
        this.mGraph!.add({
          data: { id: nodeId, title: node.title, readonly: node.readonly },
          classes: node.class,
          position: this.mMousePos,
        });
        needsLayout = true;
      } else if (prevProps.elements[id]?.class !== node.class) {
        existing.removeClass(prevProps.elements[id].class).addClass(node.class);
      }

      // Sync edges for this node - only consider outgoing edges (where this node is the source)
      // since those are the ones controlled by this node's connections array
      const existingEdges = this.mGraph!.edges(`[source = "${nodeId}"]`);
      const currentConnections = new Set<string>();
      
      // Add new edges from current connections
      (node.connections || []).forEach(connGroup => {
        (connGroup.connections || []).forEach(conn => {
          if (!elements[conn]) return;
          const from = nodeId;     // current node is the source
          const to = san(conn);    // dependency is the target
          const edgeId = `${from}-to-${to}`;
          currentConnections.add(edgeId);
          
          const existingEdge = this.mGraph!.getElementById(edgeId);
          if (existingEdge.empty()) {
            this.mGraph!.add({
              data: {
                id: edgeId,
                source: from,
                target: to,
                sourceOrig: id,      // current node is the source original
                targetOrig: conn,    // dependency is the target original
                readonly: node.readonly,
              },
              classes: connGroup.class,
            });
            needsLayout = true;
          } else {
            // Update the existing edge data to ensure consistency
            existingEdge.data('sourceOrig', id);
            existingEdge.data('targetOrig', conn);
            existingEdge.data('readonly', node.readonly);
            
            // Update classes if they changed - remove all classes and add the new one
            const currentClasses = existingEdge.classes();
            currentClasses.forEach(cls => existingEdge.removeClass(cls));
            existingEdge.addClass(connGroup.class);
          }
        });
      });

      // Remove edges that no longer exist for this node
      existingEdges.forEach(edge => {
        const edgeId = edge.id();
        if (!currentConnections.has(edgeId)) {
          this.mGraph!.remove(edge);
          needsLayout = true;
        }
      });
    });

    // Remove nodes no longer present
    Object.keys(prevProps.elements).forEach(id => {
      if (!elements[id]) {
        this.mGraph!.remove(`#${san(id)}`);
        needsLayout = true;
      }
    });

    // Force a layout update if nodes or edges were added/removed
    if (needsLayout) {
      this.mGraph.fit();
      this.mLayout?.stop();
      this.mLayout = this.mGraph.layout({
        name: 'cose-bilkent',
        nodeDimensionsIncludeLabels: true,
        randomize: false,
      } as any);
      this.mLayout.run();
    }
  }

  public layout() {
    this.mLayout.run();
  }

  public forceUpdate() {
    if (this.mGraph) {
      this.mGraph.forceRender();
      this.mGraph.fit();
    }
  }

  public render(): JSX.Element {
    const { className, style } = this.props;

    return <div ref={this.setRef} className={className} style={style} />;
  }

  private onKeyDown = (evt: KeyboardEvent) => {
    if (evt.keyCode === 17) {
      this.mEdgeHandler.enable();
      if (this.mHoveredNode?.data?.()?.title !== undefined) {
        this.mEdgeHandler.show?.(this.mHoveredNode);
      }
      // this.mEdgeHandler.enableDrawMode();
    }
  }

  private onKeyUp = (evt: KeyboardEvent) => {
    if (evt.keyCode === 17) {
      // this.mEdgeHandler.disableDrawMode();
      this.mEdgeHandler.disable();
      this.mEdgeHandler.hide();
    }
  }

  private setRef = (ref: HTMLDivElement) => {
    const { className, elements, visualStyle } = this.props;
    if (ref === null) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      (this.mGraph as any).off('cxttap', this.handleContext);
      (this.mGraph as any).off('ehcomplete', this.handleEHComplete);
      this.mGraph = undefined;
      return;
    }
    this.mGraph = cytoscape({
      container: ref,
      style: visualStyle,
      minZoom: 0.33,
      maxZoom: 3,
      wheelSensitivity: 0.1,
      boxSelectionEnabled: false,
    });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.addElements(elements);
    this.mGraph.resize();
    this.mGraph.center();
    this.mLayout = this.mGraph.layout({
      name: 'cose-bilkent',
      nodeDimensionsIncludeLabels: true,
      randomize: false,
    } as any);
    this.mLayout.run();
    this.mEdgeHandler = (this.mGraph as any).edgehandles({
      handlePosition: () => 'middle middle',
      edgeParams: () => ({ classes: className + '-edge' }),
      loopAllowed: () => false,
      hoverDelay: 0,
      snap: true,
    });
    this.mEdgeHandler.disable();
    this.mGraph.on('cxttap', this.handleContext);
    this.mGraph.on('mouseover', (evt: cytoscape.EventObject) => {
      this.mHoveredNode = evt.target;
    });
    this.mGraph.on('mouseout', () => this.mHoveredNode = undefined);
    this.mGraph.on('ehcomplete', this.handleEHComplete as any);
  }

  private handleContext = (evt: cytoscape.EventObject) => {
    let selection;
    if (evt.target.data !== undefined) {
      const data = evt.target.data();
      if (data.source !== undefined) {
        // For connections, provide both original format and new format for compatibility
        selection = { 
          source: data.sourceOrig, 
          target: data.targetOrig, 
          sourceOrig: data.sourceOrig,
          targetOrig: data.targetOrig,
          readonly: data.readonly 
        };
      } else if (data.title !== undefined) {
        selection = { id: data.title, readonly: data.readonly };
      }
    }
    this.mMousePos = evt.position;
    this.props.onContext(evt.renderedPosition.x, evt.renderedPosition.y, selection);
  }

  private handleEHComplete = (evt, source, target, added) => {
    // Prevent sync conflicts during edge creation
    this.mIsHandlingEdgeCreation = true;
    
    const sourceTitle = source.data().title;
    const targetTitle = target.data().title;
    
    // For newly created connections, invert the direction
    // When user drags from A to B, we want B to depend on A
    // So the data model edge should go from B to A
    const dataSourceTitle = targetTitle;  // inverted: target becomes source
    const dataTargetTitle = sourceTitle;  // inverted: source becomes target
    
    // Keep the automatically created edge and update it with proper data
    if ((added.data() !== undefined) && (this.mGraph !== undefined)) {
      const edgeId = `${san(dataSourceTitle)}-to-${san(dataTargetTitle)}`;
      
      // Update the edge data to match our expected format (inverted)
      added.data('id', edgeId);
      added.data('source', san(dataSourceTitle));
      added.data('target', san(dataTargetTitle));
      
      // Store sourceOrig/targetOrig as the inverted data model values
      // This matches the inverted direction we're using for the data
      added.data('sourceOrig', dataSourceTitle);
      added.data('targetOrig', dataTargetTitle);
      added.data('readonly', false);
      
      // Ensure it has the correct styling
      added.addClass(this.props.className + '-edge');
      
      // Mark this edge as recently created to prevent accidental removal
      this.mRecentlyCreatedEdges.add(edgeId);
      
      // Force a render to ensure the connection is visible
      this.mGraph.forceRender();
    }
    
    // Clear the flag after a short delay to allow edge creation to complete
    setTimeout(() => {
      this.mIsHandlingEdgeCreation = false;
      this.mRecentlyCreatedEdges.delete(`${san(dataSourceTitle)}-to-${san(dataTargetTitle)}`);
    }, 100);
    
    // Notify parent component with inverted direction
    this.props.onConnect(dataSourceTitle, dataTargetTitle);
  }

  private addElements(elements: { [id: string]: IGraphElement }) {
    const width = MAX_COLUMNS;
    const distance = (this.mGraph.width() / width) * 2;
    this.mGraph
      .add(Object.keys(elements).reduce((prev, id: string, idx: number) => {
        const ele = elements[id];
        const row = Math.floor(idx / width);
        const pos = (row % 2 === 0) ? (idx % width) : width - (idx % width);
        prev.push({
          data: { id: san(id), title: ele.title, readonly: ele.readonly },
          classes: ele.class,
          position: { x: pos * distance, y: row * distance },
        });

        (ele.connections || []).forEach(connGroup => {
          (connGroup.connections || []).forEach(conn => {
            if ((elements[id] === undefined) || (elements[conn] === undefined)) {
              // invalid connection, are connections out of sync with the nodes?
              return;
            }
            const from = san(id);    // current element is the source
            const to = san(conn);    // dependency is the target
            prev.push({
              data: {
                id: `${from}-to-${to}`,
                source: from,
                sourceOrig: id,      // current element is the source original
                target: to,
                targetOrig: conn,    // dependency is the target original
                readonly: ele.readonly,
              } as any,
              classes: connGroup.class,
            });
          });
        });

        return prev;
      }, []));
  }
}

export default GraphView;
