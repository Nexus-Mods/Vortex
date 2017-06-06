import { IActionDefinition } from '../types/IActionDefinition';
import { PropsCallback } from '../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../util/ComponentEx';

import FunctionsButton from './FunctionsButton';
import IconBar from './IconBar';
import { IconButton } from './TooltipControls';

import * as React from 'react';
import { Flex } from 'react-layout-pane';

export interface IBaseProps {
  applicationButtons: IActionDefinition[];
}

interface IToolbar {
  id: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

type IProps = IBaseProps;

/**
 * Toolbar on the main window. Can be extended
 * @class MainToolbar
 */
class MainToolbar extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { applicationButtons, t } = this.props;
    return (
      <div className='toolbar-main'>
        <IconBar
          group='application-icons'
          staticElements={applicationButtons}
        />
        <FunctionsButton />
      </div>
    );
  }
}

export default
  translate(['common'], { wait: false })((MainToolbar),
  ) as React.ComponentClass<IBaseProps>;
