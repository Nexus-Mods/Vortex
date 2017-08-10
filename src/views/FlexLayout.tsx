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
      {..._.omit(props, ['className'])}
    >
      { props.children }
    </div>
  );
};

// uses all available space for the contents but no more
const Flex = (props: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className='layout-flex'>
      <div
        className={appendClasses(props.className, ['layout-flex-inner'])}
        {..._.omit(props, ['className'])}
      >
        { props.children }
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
    const relayProps = _.omit(this.props, ['className', 'style']);

    const fullStyle = { ...style, flexDirection: type };

    const classes = ['layout-container', `layout-container-${type}`];
    if (fill !== false) {
      classes.push('layout-fill');
    }

    return (
      <div
        className={appendClasses(this.props.className, classes)}
        style={fullStyle}
        {...relayProps}
      >
        { this.props.children }
      </div>
    );
  }
}

export default FlexLayout;
