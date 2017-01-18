import Icon from './Icon';

import classNames = require('classnames');
import * as _ from 'lodash';
import * as React from 'react';

interface IFormFeedbackProps {
  pending?: boolean;
  className?: string;
}

class FormFeedbackAwesome extends React.Component<IFormFeedbackProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    $bs_formGroup: React.PropTypes.object,
  };

  public static defaultProps = {
    bsRole: 'feedback',
  };

  public render(): JSX.Element {
    const formGroup = this.context.$bs_formGroup;
    const { className } = this.props;

    const classes = ['form-control-feedback', 'feedback-awesome'];

    const { pending } = this.props;

    let elementProps = _.omit(this.props, [ 'pending', 'bsRole' ]);

    let icon: JSX.Element = this.icon(formGroup && formGroup.validationState, pending);
    if (icon === undefined) {
      return null;
    } else {
      return (
        <div {...elementProps} className={classNames(className, classes)}>
          { icon }
        </div>
      );
    }
  }

  private icon(state: string, pending: boolean): JSX.Element {
    const style = { height: 'initial', verticalAlign: 'baseline' };
    if (pending) {
      return <Icon name='spinner' pulse style={ style } />;
    }
    switch (state) {
      case 'success': return <Icon name='check' style={ style } />;
      case 'warning': return <Icon name='warning' style={ style } />;
      case 'error': return <Icon name='remove' style={ style } />;
      default: return undefined;
    }
  }
}

export default FormFeedbackAwesome;
