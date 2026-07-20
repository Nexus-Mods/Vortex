/**
 * Whether a hovered row should swap with the dragged row. The swap only happens
 * once the cursor has passed the hovered row's vertical middle, so rows don't
 * flip back and forth while the cursor sits near a boundary. `cursorY` and
 * `midpointY` are relative to the hovered row's top.
 */
export function shouldReorder(
  dragIndex: number,
  hoverIndex: number,
  cursorY: number,
  midpointY: number,
): boolean {
  if (dragIndex === hoverIndex) {
    return false;
  }
  // dragging down: wait until the cursor is past the middle
  if (dragIndex < hoverIndex && cursorY < midpointY) {
    return false;
  }
  // dragging up: wait until the cursor is past the middle
  if (dragIndex > hoverIndex && cursorY > midpointY) {
    return false;
  }
  return true;
}

/**
 * Move `movers` to `toIndex` within a copy of `list`, preserving their relative
 * order. Each mover may be an item or a single-element array (a multi-select
 * take yields arrays); the array's first element is used. Items not found in
 * the list are simply inserted.
 */
export function moveItems<T>(list: T[], movers: Array<T | T[]>, toIndex: number): T[] {
  const copy = list.slice();
  movers.forEach((item) => {
    const index = copy.indexOf(item as T);
    if (index !== -1) {
      copy.splice(index, 1);
    }
  });
  let insertAt = toIndex;
  movers.forEach((itm) => {
    const item = (Array.isArray(itm) ? itm[0] : itm) as T;
    copy.splice(insertAt, 0, item);
    insertAt += 1;
  });
  return copy;
}
