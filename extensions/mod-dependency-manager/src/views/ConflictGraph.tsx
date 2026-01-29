import { IBiDirRule } from "../types/IBiDirRule";
import { IConflict } from "../types/IConflict";
import genGraphStyle from "../util/genGraphStyle";

import { setEditCycle } from "../actions";
import { NAMESPACE } from "../statics";

import GraphView, { IGraphElement, IGraphSelection } from "./GraphView";

import * as _ from "lodash";
import { IReference, IRule } from "modmeta-db";
import * as React from "react";
import { Button } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import {
  actions,
  ComponentEx,
  ContextMenu,
  Modal,
  selectors,
  Spinner,
  types,
  Usage,
  util,
} from "vortex-api";

interface ILocalState {
  modRules: IBiDirRule[];
}

export interface IConflictGraphProps {
  width: number;
  height: number;
  nodeDistance: number;
  nodeRadius: number;
  localState: ILocalState;
}

interface IConnectedProps {
  conflicts: { [modId: string]: IConflict[] };
  mods: { [modId: string]: types.IMod };
  editCycle: { gameId: string; modIds: string[] };
}

interface IActionProps {
  onClose: () => void;
  onAddRule: (gameId: string, modId: string, rule: IRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IRule) => void;
}

interface IFauxProps {
  connectFauxDOM: (id: string, name: string) => any;
  animateFauxDOM: (delay: number) => void;
  stopAnimatingFauxDOM: () => void;
  drawFauxDOM: () => void;
  chart: any;
}

type IProps = IConflictGraphProps & IConnectedProps & IActionProps & IFauxProps;

interface IComponentState {
  highlighted: { source: string; target: string };
  counter: number;

  context: {
    x: number;
    y: number;
    selection?: IGraphSelection;
  };

  elements: { [id: string]: IGraphElement };
  // working indicates that we changed a rule and haven't received updated rules through props yet
  working: boolean;
}

class ConflictGraph extends ComponentEx<IProps, IComponentState> {
  private mProxy: any;
  private mGraphRef: GraphView;
  private mContextTime: number;

  private contextNodeActions = [
    {
      title: "Highlight Cycle",
      show: true,
      action: () => this.highlightCycle(),
    },
    {
      title: "Load Last (among connected)",
      show: true,
      action: () => this.loadLast(),
    },
  ];

  private contextEdgeActions = [
    {
      title: "Flip Rule",
      show: true,
      action: () => this.flipRule(),
    },
    {
      title: "Remove Rule",
      show: true,
      action: () => this.removeRule(),
    },
  ];

  private contextBGActions = [
    {
      title: "Layout",
      show: true,
      action: () => this.mGraphRef.layout(),
    },
  ];

  constructor(props: IProps) {
    super(props);
    this.initState({
      highlighted: undefined,
      counter: 0,
      context: undefined,
      elements: undefined,
      working: false,
    });
    // TODO: horrible hack, just to get this to update when mod rules change
    this.mProxy = {
      setState: () => {
        this.nextState.counter++;
        this.nextState.working = false;
        this.updateGraph(this.props);
      },
    };
  }

  public componentDidMount() {
    this.nextState.highlighted = undefined;
    (this.props.localState as any).attach(this.mProxy);
  }

  public componentWillUnmount() {
    (this.props.localState as any).detach(this.mProxy);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (newProps.editCycle === undefined) {
      return;
    }

    if (
      !this.state.working &&
      (this.props.conflicts !== newProps.conflicts ||
        this.props.mods !== newProps.mods ||
        this.props.editCycle !== newProps.editCycle)
    ) {
      this.updateGraph(newProps);
    }
  }

  public render(): JSX.Element {
    const { t, editCycle } = this.props;
    const { working } = this.state;
    if (editCycle === undefined) {
      return null;
    }

    let contextActions;
    if (this.state.context !== undefined) {
      contextActions =
        this.state.context.selection !== undefined
          ? this.state.context.selection.id !== undefined
            ? this.contextNodeActions
            : this.contextEdgeActions
          : this.contextBGActions;
    }

    return (
      <Modal
        id="conflict-graph-dialog"
        show={editCycle !== undefined}
        onHide={this.close}
      >
        <Modal.Header>
          <Modal.Title>{t("Cycle")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {working ? (
            <div className="conflict-graph-working">
              <Spinner />
            </div>
          ) : (
            this.renderGraph()
          )}
          <ContextMenu
            position={this.state.context}
            visible={this.state.context !== undefined}
            onHide={this.hideContext}
            instanceId="42"
            actions={contextActions}
          />
          <Usage infoId="conflicting-mods" persistent>
            <div>
              {t(
                "This screen shows a cluster of mods that form one or more cycles.",
              )}
            </div>
            <div>
              {t(
                'Arrows can be read as "then" (A ->- B reads "A, then B"), meaning the mod the ' +
                  "arrow points towards is the one that overwrites the first one.",
              )}
            </div>
            <div>
              {t(
                "If there are too many connections you can highlight a single cycle " +
                  "by right-clicking on one of the mods.",
              )}
            </div>
            <div>
              {t(
                "You can resolve a cycle by either removing or flipping one rule, " +
                  "so if you have a cycle A->-B->-C->-A you could flip the arrow " +
                  "between C and A to get A->-B->-C-<-A which is no longer a cycle. " +
                  "Repeat this until there are no cycles left.",
              )}
            </div>
          </Usage>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>{t("Close")}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private openContext = (x: number, y: number, selection: IGraphSelection) => {
    if (selection !== undefined && selection.readonly) {
      return;
    }
    this.nextState.context = { x, y, selection };
    this.mContextTime = Date.now();
  };

  private hideContext = () => {
    if (Date.now() - this.mContextTime < 100) {
      // workaround: somehow I can't prevent the event that opens the context menu from being
      // propagated up, which will be picked up as close event
      return;
    }
    this.nextState.context = undefined;
  };

  private getThemeSheet(): CSSStyleRule[] {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < document.styleSheets.length; ++i) {
      if ((document.styleSheets[i].ownerNode as any).id === "theme") {
        return Array.from((document.styleSheets[i] as any).rules);
      }
    }
    return [];
  }

  private getAllLinks(props: IProps, modId: string): string[] {
    const { editCycle, localState, mods } = props;
    return localState.modRules
      .filter(
        (rule) =>
          rule.type === "after" &&
          util.testModReference(mods[modId], rule.source),
      )
      .map((rule) =>
        editCycle.modIds.filter((refId) =>
          util.testModReference(mods[refId], rule.reference),
        ),
      )
      .reduce((prev, refs) => {
        const newRefs = refs.filter((refId) => !prev.includes(refId));
        return [...prev, ...newRefs];
      }, []);
  }

  private updateGraph(props: IProps) {
    const { editCycle, mods } = props;

    if (editCycle === undefined) {
      this.nextState.elements = {};
      return;
    }

    const elements: { [id: string]: IGraphElement } = editCycle.modIds.reduce(
      (prev, modId) => {
        if (mods[modId] !== undefined) {
          prev[modId] = {
            title: util.renderModName(mods[modId]),
            connections: this.getAllLinks(props, modId),
            class: `conflictnode`,
            readonly: false,
          };
        }
        return prev;
      },
      {},
    );

    this.nextState.elements = elements;
  }

  private renderGraph(): JSX.Element {
    const { elements } = this.state;
    const sheet = this.getThemeSheet();

    return (
      <GraphView
        className="conflict-graph"
        elements={elements}
        visualStyle={genGraphStyle(sheet)}
        onContext={this.openContext}
        ref={this.setGraphRef}
      />
    );
  }

  private setGraphRef = (ref: GraphView) => {
    this.mGraphRef = ref;
  };

  private close = () => {
    const { onClose } = this.props;
    onClose();
  };

  private highlightCycle = () => {
    const { id } = this.state.context.selection;

    try {
      this.mGraphRef.highlightCycle(id);
    } catch (err) {
      this.context.api.showErrorNotification("Failed to highlight cycle", err);
    }
  };

  private loadLast = () => {
    const { id } = this.state.context.selection;

    const { editCycle, localState, mods, onAddRule, onRemoveRule } = this.props;

    // all rules where the selected node is loaded before something else
    const beforeRules = localState.modRules.filter(
      (rule) =>
        rule.original &&
        ((rule.type === "before" &&
          util.testModReference(mods[id], rule.source)) ||
          (rule.type === "after" &&
            util.testModReference(mods[id], rule.reference))),
    );

    const connReferences: IReference[] = [];

    beforeRules.forEach((rule) => {
      if (rule.type === "before") {
        // selected mod is the original

        const otherId = editCycle.modIds.find((modId) =>
          util.testModReference(mods[modId], rule.reference),
        );
        if (editCycle.modIds.includes(otherId)) {
          connReferences.push(rule.reference);
          onRemoveRule(editCycle.gameId, id, rule);
        }
      } else {
        const sourceId = editCycle.modIds.find((modId) =>
          util.testModReference(mods[modId], rule.source),
        );

        if (editCycle.modIds.includes(sourceId)) {
          connReferences.push(rule.source);
          onRemoveRule(editCycle.gameId, sourceId, rule);
        }
      }
    });

    const modIds: Set<string> = new Set();
    connReferences.forEach((connRef) => {
      const destId = editCycle.modIds.find((modId) =>
        util.testModReference(mods[modId], connRef),
      );

      if (!modIds.has(destId)) {
        modIds.add(destId);
        onAddRule(editCycle.gameId, id, {
          type: "after",
          reference: connRef,
        });
      }
    });
  };

  private flipRule = () => {
    const { editCycle, localState, mods, onAddRule } = this.props;
    const { selection } = this.state.context;

    const bidirRule = localState.modRules.find(
      (iter) =>
        iter.type === "before" &&
        util.testModReference(mods[selection.source], iter.source) &&
        util.testModReference(mods[selection.target], iter.reference),
    );
    if (bidirRule === undefined) {
      return;
    }

    const sourceId = bidirRule.original ? selection.source : selection.target;
    // this rule is the inverse (type swapped after <-> before) to the one that
    // exists
    const rule: IRule = {
      type: bidirRule.original ? "after" : "before",
      reference: bidirRule.original ? bidirRule.reference : bidirRule.source,
    };

    this.nextState.working = true;

    // addModRule takes care of replacing the existing rule. We could remove the old rule first
    // but that would trigger two updates
    onAddRule(editCycle.gameId, sourceId, rule);
  };

  private removeRule = () => {
    const { editCycle, localState, mods, onRemoveRule } = this.props;
    const { selection } = this.state.context;

    const bidirRule = localState.modRules.find(
      (rule) =>
        rule.type === "before" &&
        util.testModReference(mods[selection.source], rule.source) &&
        util.testModReference(mods[selection.target], rule.reference),
    );
    if (bidirRule === undefined) {
      return;
    }
    const sourceId = bidirRule.original ? selection.source : selection.target;
    const remRule: IRule = {
      type: bidirRule.original ? "before" : "after",
      reference: bidirRule.original ? bidirRule.reference : bidirRule.source,
    };

    this.nextState.working = true;
    onRemoveRule(editCycle.gameId, sourceId, remRule);
  };
}

const emptyObj = {};

function mapStateToProps(state: types.IState, props: IProps): IConnectedProps {
  let editCycle =
    util.getSafe(state, ["session", "dependencies", "editCycle"], undefined) ||
    undefined;
  const gameMode = selectors.activeGameId(state);
  let gameId = editCycle !== undefined ? editCycle.gameId : undefined;
  if (gameMode !== gameId) {
    editCycle = undefined;
    gameId = undefined;
  }
  return {
    conflicts: util.getSafe(
      state,
      ["session", "dependencies", "conflicts"],
      emptyObj,
    ),
    mods: gameId !== undefined ? state.persistent.mods[gameId] : emptyObj,
    editCycle,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onClose: () => dispatch(setEditCycle(undefined, undefined)),
    onAddRule: (gameId, modId, rule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId, modId, rule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(ConflictGraph) as any,
) as React.ComponentClass<IConflictGraphProps>;
