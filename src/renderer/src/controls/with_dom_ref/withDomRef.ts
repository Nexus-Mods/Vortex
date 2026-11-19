// react-bootstrap 0.33's components (Button, MenuItem) don't pass a ref on to the element they
// render, so getting at that element used to take findDOMNode. They do render their
// componentClass with every prop they don't use themselves, so a componentClass made here, given
// a domRef prop, hands back the element instead.
import { createElement, type FC, type HTMLAttributes, type Ref } from "react";

export type WithDomRefProps<K extends keyof HTMLElementTagNameMap> = HTMLAttributes<
  HTMLElementTagNameMap[K]
> & {
  /** receives the rendered element */
  domRef?: Ref<HTMLElementTagNameMap[K]>;
};

/**
 * Makes a component that renders a `tag` element and hands that element to its `domRef` prop.
 * Pass it to a react-bootstrap 0.33 component as `componentClass`, with `domRef`.
 */
export function withDomRef<K extends keyof HTMLElementTagNameMap>(tag: K): FC<WithDomRefProps<K>> {
  const ElementWithDomRef: FC<WithDomRefProps<K>> = ({ domRef, ...props }) =>
    createElement(tag, { ...props, ref: domRef });
  ElementWithDomRef.displayName = `withDomRef(${tag})`;
  return ElementWithDomRef;
}
