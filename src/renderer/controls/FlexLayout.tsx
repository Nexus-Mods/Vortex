import * as _ from 'lodash';
import * as React from 'react';

function appendClasses(old: string, add: string[]): string {
  const addStr = add.join(' ');
  return old ? old + ' ' + addStr : addStr;
}

// minimize but fit the content
const Fixed = (props: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={appendClasses(props.className, ['layout-fixed'])}
      {..._.omit(props, ['className']) as any}
    >
      {props.children}
    </div>
  );
};

export interface IFlexProps {
  fill?: boolean;
}

// uses all available space for the contents but no more
const Flex = (props: IFlexProps & React.HTMLAttributes<HTMLDivElement>) => {
  let outerClasses = ['layout-flex'];
  if (props.className) {
    outerClasses = outerClasses.concat(props.className.split(' ').map(cl => cl + '-outer'));
  }
  const classes = ['layout-flex-inner'];
  if (props.fill === true) {
    classes.push('layout-flex-fill');
  }
  return (
    <div className={outerClasses.join(' ')}>
      <div
        className={appendClasses(props.className, classes)}
        {..._.omit(props, ['className', 'fill']) as any}
      >
        {props.children}
      </div>
    </div>
  );
};

export interface IFlexLayoutProps {
  type: 'column' | 'row';
  fill?: boolean;
}

export type IProps = IFlexLayoutProps & React.HTMLAttributes<HTMLDivElement>;

// flexbox based layouting class
class FlexLayout extends React.PureComponent<IProps, {}> {
  public static Fixed = Fixed;
  public static Flex = Flex;

  public render(): JSX.Element {
    const { fill, style, type } = this.props;
    const relayProps = _.omit(this.props, ['className', 'fill', 'style']);

    const fullStyle = { ...style, flexDirection: type };

    const classes = ['layout-container', `layout-container-${type}`];
    if (fill !== false) {
      classes.push('layout-fill');
    }

    return (
      <div
        className={appendClasses(this.props.className, classes)}
        style={fullStyle}
        {...relayProps as any}
      >
        {this.props.children}
      </div>
    );
  }
}

export default FlexLayout;
