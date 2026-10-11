import { createContext, useContext } from "react";

/** Whether a row has been pointed at or focused since it rendered. */
export const TableRowEngagedContext = createContext(false);

/**
 * Whether the row a cell is in has been pointed at or focused since it rendered, and stays so
 * while the row does: so a cell can hold off mounting what only shows then. False outside a row.
 */
export const useTableRowEngaged = () => useContext(TableRowEngagedContext);
