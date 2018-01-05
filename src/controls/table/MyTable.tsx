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
    <div
      style={{ ...props.style, display: 'table' }}
      className={classes.join(' ')}
    >
      {props.children}
    </div>
  );
}

export type DProps<T> = React.DetailedHTMLProps<React.HTMLAttributes<T>, T>;

export function THead(props: DProps<HTMLTableSectionElement>
                              & { domRef?: ((instance: any | null) => any) }) {
  const classes = ['table-header', 'xthead'].concat((props.className || '').split(' '));
  return (
    <div
      style={{ ...props.style, display: 'table-header-group' }}
      className={classes.join(' ')}
      ref={props.domRef}
    >
      {props.children}
    </div>
  );
}

export function TBody(props: DProps<HTMLTableSectionElement>
                              & { domRef?: ((instance: any | null) => any) }) {
  const classes = ['xtbody'].concat((props.className || '').split(' '));
  return (
    <div
      style={{ ...props.style, display: 'table-row-group' }}
      className={classes.join(' ')}
      ref={props.domRef}
    >
      {props.children}
    </div>
  );
}

export function TH(props: DProps<HTMLTableHeaderCellElement>) {
  const classes = ['table-header-cell', 'xth'].concat((props.className || '').split(' '));
  return (
    <div
      style={{ ...props.style, display: 'table-cell' }}
      className={classes.join(' ')}
      {..._.omit(props, ['style', 'className'])}
    >
      {props.children}
    </div>
  );
}
export function TR(props: DProps<HTMLTableRowElement>) {
  const classes = ['xtr'].concat((props.className || '').split(' '));
  return (
    <div
      style={{ ...props.style, display: 'table-row' }}
      className={classes.join(' ')}
    >
      {props.children}
    </div>
  );
}

export function TD(props: DProps<HTMLTableCellElement>) {
  const classes = ['xtd'].concat((props.className || '').split(' '));
  return (
    <div
      style={{ ...props.style, display: 'table-cell' }}
      className={classes.join(' ')}
      {..._.omit(props, ['style', 'className'])}
    >
      {props.children}
    </div>
  );
}
