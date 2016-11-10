 import classNames = require('classnames');
import * as React from 'react';
import { FormControl } from 'react-bootstrap';

import Icon from './Icon';

class FormFeedbackAwesome extends FormControl.Feedback {
  protected renderDefaultFeedback(formGroup, className, classes, elementProps) {
    let icon: JSX.Element = this.icon(formGroup && formGroup.validationState);
    if (icon === undefined) {
      return null;
    } else {
      return (
        <div {...elementProps} className={classNames(className, classes) }>
          { icon }
        </div>
      );
    }
  }

  private icon(state: string): JSX.Element {
    const style = { width: 'inherit', height: 'inherit',
                    verticalAlign: 'baseline', padding: '2px' };
    switch (state) {
      case 'success': return <Icon name='check' style={ style } />;
      case 'warning': return <Icon name='warning' style={ style } />;
      case 'error': return <Icon name='remove' style={ style } />;
      case 'pending': return <Icon name='spinner' pulse style={ style } />;
      default: return undefined;
    }
  }
}

export default FormFeedbackAwesome;
