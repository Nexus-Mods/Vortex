import {IExtensionApi} from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import {showError} from '../../../util/message';
import { truthy } from '../../../util/util';

import DelegateBase from './DelegateBase';

import { inspect } from 'util';

class UI extends DelegateBase {
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;

  constructor(api: IExtensionApi, gameId: string) {
    super(api);

    // api.events
    //   .on('fomod-installer-select', this.onDialogSelect)
    //   .on('fomod-installer-continue', this.onDialogContinue)
    //   .on('fomod-installer-cancel', this.onDialogEnd);
  }

  public detach() {
    // this.api.events
    //   .removeListener('fomod-installer-select', this.onDialogSelect)
    //   .removeListener('fomod-installer-continue', this.onDialogContinue)
    //   .removeListener('fomod-installer-cancel', this.onDialogEnd);
  }
}

export default UI;
