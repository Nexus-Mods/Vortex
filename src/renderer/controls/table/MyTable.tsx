/**
 * replacement for the react table using
 * the css display classes 'table', 'table-row' and so on
 * instead of <table>, <tr>, ... for more flexibility
 */

import * as _ from 'lodash';
import * as React from 'react';
import { TableProps } from 'react-bootstrap';

export function Table(props: TableProps) {
  const classes = ['table', 'xtable'].concat((props.className || '').split(' '));
  if (props.condensed === true) {
    classes.push('table-condensed');
  }
  if (props.hover === true) {
    classes.push('table-hover');
  }

  return (
    <table
      style={{ ...props.style }}
      className={classes.join(' ')}
    >
      {props.children}
    </table>
  );
}

export type DProps<T> = React.DetailedHTMLProps<React.HTMLAttributes<T>, T>;

export function THead(props: DProps<HTMLTableSectionElement>
                              & { domRef?: ((instance: any | null) => any) }) {
  const classes = ['table-header', 'xthead'].concat((props.className || '').split(' '));
  return (
    <thead
      style={{ ...props.style }}
      className={classes.join(' ')}
      ref={props.domRef}
    >
      {props.children}
    </thead>
  );
}

export function TBody(props: DProps<HTMLTableSectionElement>
                              & { domRef?: ((instance: any | null) => any) }) {
  const classes = ['xtbody'].concat((props.className || '').split(' '));
  return (
    <tbody
      style={{ ...props.style }}
      className={classes.join(' ')}
      ref={props.domRef}
    >
      {props.children}
    </tbody>
  );
}

type THProps = DProps<HTMLTableHeaderCellElement> & { domRef?: (ref: HTMLDivElement) => void };

export class TH extends React.Component<THProps, {}> {
  public render() {
    const { children, className, domRef, style } = this.props;
    const classes = ['table-header-cell', 'xth'].concat((className || '').split(' '));
    return (
      <th
        style={{ ...style }}
        className={classes.join(' ')}
        ref={domRef}
        {..._.omit(this.props, ['style', 'className', 'domRef']) as any}
      >
        {children}
      </th>
    );
  }
}

type TRProps = DProps<HTMLTableRowElement> & { domRef?: (ref: HTMLDivElement) => void };

export function TR(props: TRProps) {
  const {className, domRef} = props;
  const classes = ['xtr'].concat((className || '').split(' '));
  return (
    <tr
      className={classes.join(' ')}
      ref={domRef}
      {..._.omit(props, ['className', 'domRef']) as any}
    >
      {props.children}
    </tr>
  );
}

type TDProps = DProps<HTMLTableCellElement> & {
  domRef?: (ref: HTMLDivElement) => void;
  colSpan?: number;
};

export function TD(props: TDProps) {
  const classes = ['xtd'].concat((props.className || '').split(' '));
  return (
    <td
      className={classes.join(' ')}
      {..._.omit(props, ['className', 'domRef']) as any}
      ref={props.domRef}
    >
      {props.children}
    </td>
  );
}
