import Promise from 'bluebird';
import * as React from 'react';

const debugMissingIcons = process.env.NODE_ENV === 'development';
const debugReported = new Set<string>();

/**
 * icon props
 */
export interface IIconProps {
  className?: string;
  style?: React.CSSProperties;
  /** icon set (aka namespace) to load from */
  set?: string;
  /** icon id */
  name: string;
  /** use css animation to spin */
  spin?: boolean;
  /** use css animation to pulse (spin in 8 distinct steps) */
  pulse?: boolean;
  /** set a stroke color */
  stroke?: boolean;
  /** disable fill color */
  hollow?: boolean;
  /** draw a (css) border around the control */
  border?: boolean;
  /** flip icon horizonally or vertically */
  flip?: 'horizontal' | 'vertical';
  /** rotate by specified number of degrees */
  rotate?: number;
  /**
   * rotation is somewhat expensive computationally. Specifying an id here for a rotated variant of
   * the icon lets vortex cache some data to eliminate that computation
   */
  rotateId?: string;
  /**
   * style to be passed into the svg component
   */
  svgStyle?: string;

  /**
   * get access to the specified set. This allows implementations to lazy-load icon sets
   * on demand
   */
  getSet: (set: string) => Promise<Set<string>>;

  onContextMenu?: React.MouseEventHandler<any>;
}

/**
 * renders a svg icon (as an instance/ref of a globally defined svg)
 */
class Icon extends React.Component<IIconProps, {}> {
  private static sCache: { [id: string]: { width: number, height: number } } = {};
  private mCurrentSize: { width: number, height: number };

  public componentDidMount() {
    this.setIcon(this.props);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IIconProps) {
    this.setIcon(newProps);
  }

  public render(): JSX.Element {
    const { name, style, svgStyle } = this.props;

    let classes = ['icon', `icon-${name}`];
    // avoid using css for transforms. For one thing this is more flexible but more importantly
    // it has no interactions with other css. For example css transforms tend to break z ordering
    const transforms = [];

    if (this.props.spin || (name === 'spinner')) {
      classes.push('icon-spin');
    }

    if (this.props.pulse) {
      classes.push('icon-pulse');
    }

    if (this.props.border) {
      classes.push('icon-border');
    }

    if (this.props.stroke) {
      classes.push('icon-stroke');
    }

    if (this.props.hollow) {
      classes.push('icon-hollow');
    }

    if (this.props.flip) {
      transforms.push(this.props.flip === 'horizontal'
        ? `scale(-1, 1)`
        : `scale(1, -1)`);
    }

    if (this.props.rotate) {
      // narf... I can't use css transform for the rotation because that somehow
      // messes up the z-ordering of items.
      // with svg transforms we have to provide the center of rotation ourselves
      // and we can't use relative units.
      if (this.mCurrentSize !== undefined) {
        const { width, height } = this.mCurrentSize;
        transforms.push(
          `rotate(${this.props.rotate}, ${Math.floor(width / 2)}, ${Math.floor(height / 2)})`);
      }
    }

    if (this.props.className !== undefined) {
      classes = classes.concat(this.props.className.split(' '));
    }

    return (
      <svg
        preserveAspectRatio='xMidYMid meet'
        className={classes.join(' ')}
        style={style}
        ref={this.props.rotate && (this.mCurrentSize === undefined) ? this.setRef : undefined}
        onContextMenu={this.props.onContextMenu}
      >
        {svgStyle !== undefined ? <style type='text/css'>{svgStyle}</style> : null}
        <use className='svg-use' xlinkHref={`#icon-${name}`} transform={transforms.join(' ')} />
      </svg>
    );
  }

  private setRef = (ref: Element) => {
    if (ref !== null) {
      const { width, height } = ref.getBoundingClientRect();
      this.mCurrentSize = { width, height };
      this.forceUpdate();
      if (this.props.rotateId !== undefined) {
        Icon.sCache[this.props.rotateId] = this.mCurrentSize;
      }
    }
  }

  private setIcon(props: IIconProps) {
    const set = props.set || 'icons';
    props.getSet(set)
    .then(requiredSet => {
      if (debugMissingIcons
          && (requiredSet !== null)
          && !requiredSet.has('icon-' + props.name)
          && !debugReported.has(props.name)) {
        // tslint:disable-next-line:no-console
        console.trace('icon missing', props.name);
        debugReported.add(props.name);
      }
    });

    if (props.rotate && (props.rotateId !== undefined) && (this.mCurrentSize === undefined)) {
      this.mCurrentSize = Icon.sCache[props.rotateId];
    }
  }
}

export default Icon;
