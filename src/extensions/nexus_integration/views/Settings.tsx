import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { setAssociatedWithNXMURLs } from '../actions/settings';

import * as React from 'react';
import { Checkbox, FormGroup, HelpBlock } from 'react-bootstrap';

interface IBaseProps {
}

interface IConnectedProps {
  associated: boolean;
}

interface IActionProps {
  onAssociate: (associate: boolean) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, associated } = this.props;

    return (
      <form>
        <FormGroup>
          <Checkbox
            checked={ associated }
            onChange={ this.associate }
            disabled={ process.platform === 'linux' }
          >
            { t('Associate with NXM URLs') }
          </Checkbox>
          { process.platform === 'linux' ? <HelpBlock>Not supported on Linux</HelpBlock> : null  }
        </FormGroup>
      </form>
    );
  }

  private associate = (evt: React.MouseEvent) => {
    const { onAssociate } = this.props;
    onAssociate((evt.target as HTMLInputElement).checked);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    associated: state.settings.nexus.associateNXM,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onAssociate: (associate: boolean): void => {
      dispatch(setAssociatedWithNXMURLs(associate));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(Settings)
  ) as React.ComponentClass<{}>;
