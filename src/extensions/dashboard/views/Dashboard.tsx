import {PropsCallback} from '../../../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../../../util/ComponentEx';

import * as React from 'react';
import {Col, Grid, Row} from 'react-bootstrap';

interface IDashletProps {
  title: string;
  width: 1 | 2 | 3;
  position: number;
  component: React.ComponentClass<any>;
  props?: PropsCallback;
  isVisible?: (state: any) => boolean;
}

interface IExtensionProps {
  objects: IDashletProps[];
}

type IProps = IExtensionProps;

interface IRenderedDash {
  props: IDashletProps;
  comp: JSX.Element;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, objects } = this.props;

    const sorted = objects.sort(
      (lhs: IDashletProps, rhs: IDashletProps) => lhs.position - rhs.position);

    const rendered = sorted
    .filter((dash: IDashletProps) =>
      dash.isVisible === undefined || dash.isVisible(this.context.api.store.getState()))
    .map((dash: IDashletProps) => {
      const compProps = dash.props !== undefined ? dash.props() : {};
      return {
        props: dash,
        comp: <dash.component t={t} {...compProps } />,
      };
    });

    const grouped = this.rowGrouped(rendered);

    return (<Grid>
      {grouped.map(this.renderRow)}
    </Grid>
    );
  }

  private renderRow = (row: IRenderedDash[], idx: number): JSX.Element => {
    return (<Row key={idx.toString()}>
      {row.map(this.renderCol)}
    </Row>);
  }

  private renderCol = (dash: IRenderedDash): JSX.Element => {
    return (<Col key={dash.props.title} md={dash.props.width * 4}>
      {dash.comp}
    </Col>);
  }

  private rowGrouped(items: IRenderedDash[]) {
    let rows: { freeSpots: number, dashlets: IRenderedDash[] }[] = [];

    items.forEach((dash: IRenderedDash) => {
      let idx = rows.findIndex((row) => row.freeSpots >= dash.props.width);
      if (idx === -1) {
        idx = rows.length;
        rows.push({
          dashlets: [],
          freeSpots: 3,
        });
      }
      rows[idx].dashlets.push(dash);
      rows[idx].freeSpots -= dash.props.width;
    });

    return rows.map((row) => row.dashlets);
  }
}

function registerDashlet(instance: Dashboard,
                         title: string,
                         width: 1 | 2 | 3,
                         position: number,
                         component: React.ComponentClass<any>,
                         isVisible?: (state) => boolean,
                         props?: PropsCallback): IDashletProps {
  return { title, position, width, component, isVisible, props };
}

export default translate([ 'common' ], { wait: true })(
  extend(registerDashlet)(
    Dashboard
  )
) as React.ComponentClass<{}>;
