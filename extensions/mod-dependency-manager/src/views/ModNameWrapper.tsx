import React from "react";
import { useSelector, useStore } from "react-redux";
import Redux from "redux";
import { actions, Icon, selectors, tooltip, types, util } from "vortex-api";

export interface IModNameWrapper {
  rowId: string;
}

const emptyArray = [];

function ModNameWrapper(props: React.PropsWithChildren<IModNameWrapper>) {
  const { rowId } = props;

  const gameId = useSelector(selectors.activeGameId);
  const filter = useSelector<types.IState, string[]>(
    (state) =>
      state.settings.tables["mods"]?.filter?.["dependencies"] ?? emptyArray,
  );
  const columnEnabled = useSelector<types.IState, any>(
    (state) =>
      state.settings.tables["mods"]?.attributes?.["dependencies"]?.enabled ??
      false,
  );
  const mod = useSelector<types.IState, types.IMod>(
    (state) => state.persistent.mods[gameId]?.[rowId],
  );

  const store: Redux.Store<types.IState> = useStore();

  const filterByDependencies = React.useCallback(() => {
    const batch = [];
    batch.push(
      actions.setAttributeFilter("mods", "dependencies", [
        "depends",
        rowId,
        util.renderModName(mod),
      ]),
    );
    const { attributes } = store.getState().settings.tables["mods"] ?? {};
    Object.keys(attributes ?? {}).forEach((key) => {
      if (key !== "dependencies" && attributes[key].sortDirection !== "none") {
        batch.push(actions.setAttributeSort("mods", key, "none"));
      }
    });

    batch.push(actions.setAttributeVisible("mods", "dependencies", true));
    batch.push(actions.setAttributeSort("mods", "dependencies", "asc"));
    util.batchDispatch(store, batch);
  }, [store, rowId]);

  const indent =
    filter.length >= 2 && filter[0] === "depends" && filter[1] !== rowId;
  const icons = [];

  const classes = ["modname-filter-wrapper"];
  if (indent && columnEnabled) {
    classes.push("modname-filter-indented");

    icons.push(
      <Icon
        key="dependency"
        name="turn-s"
        rotate={270}
        rotateId="turn-s-270"
        className="filter-dependencies-icon"
      />,
    );
  }

  if (
    (mod?.rules ?? []).find((iter) =>
      ["requires", "recommends"].includes(iter.type),
    )
  ) {
    icons.push(
      <tooltip.IconButton
        key="filter-dependencies"
        icon="filter-dependencies"
        className="filter-dependencies-icon"
        data-modid={rowId}
        onClick={filterByDependencies}
      />,
    );
  }

  return (
    <div className={classes.join(" ")}>
      {...icons}
      {props.children}
    </div>
  );
}

export default ModNameWrapper;
