import * as _ from 'lodash';
import * as React from 'react';

function appendClasses(old: string, add: string[]): string {
  const addStr = add.join(' ');
  return old ? old + ' ' + addStr : addStr;
}

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

const Flex = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const fullStyle = {
    position: 'absolute' as 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    ...props.style,
  };
  return (
    <div className='layout-flex'>
      <div {..._.omit(props, ['style'])} style={fullStyle}>
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

    const classes = ['layout-container'];
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
