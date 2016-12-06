import { IComponentContext } from '../../../types/IComponentContext';

import { connect } from '../../../util/ComponentEx';

import { ISavegame } from '../types/ISavegame';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';

import IconBar from '../../../views/IconBar';

import { IIconDefinition } from '../../../types/IIconDefinition';

import { showDialog } from '../../../actions/notifications';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';

import { removeSavegame } from '../actions/session';

import { log } from '../../../util/log';
import * as util from 'util';

import * as React from 'react';

export interface IBaseProps {
  save: ISavegame;
  attributes: ISavegameAttribute[];
  language: string;
  onClick: __React.MouseEventHandler;
  selected: boolean;
}

interface IActionProps {
  onRemoveSavegame: (savegameId: string) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
    actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IActionProps;

class SavegameRow extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  private savegameActions: IIconDefinition[];

  constructor(props) {
    super(props);

    this.savegameActions = [
      {
        icon: 'remove',
        title: 'Delete',
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {
    const { attributes, onClick, save, selected } = this.props;

    let classes = ['save-' + save.id];
    if (selected) {
      classes.push('savegamelist-selected');
    }

    return (
      <tr
        id={save.id}
        key={save.id}
        className={classes.join(' ')}
        onClick={onClick}
      >
        {attributes.map(this.renderAttribute)}
        <td style={{ textAlign: 'center' }}>
          <IconBar
            group='save-action-icons'
            instanceId={save.id}
            className='table-actions'
            staticElements={this.savegameActions}
          />
        </td>
      </tr>
    );
  }

  private remove = () => {
    const { save, onRemoveSavegame, onShowDialog } = this.props;

    let removeSavegame = true;

    onShowDialog('question', 'Are you sure to remove this savegame?', {}, {
      Cancel: null,
      Continue: null,
    }).then((result: IDialogResult) => {
      log('info', 'res', util.inspect(result));
      removeSavegame = result.action === 'Continue';
      if (removeSavegame) {
        return fs.removeAsync(save.id);
      } else {
        return Promise.resolve();
      }
    })
      .then(() => {
        if (removeSavegame) {
          onRemoveSavegame(save.id);
        }
      });
  }

  private renderAttribute = (attribute: ISavegameAttribute): JSX.Element => {
    const { save } = this.props;
    return (
      <td key={attribute.id}>
        {this.renderCell(attribute.calc(save.attributes))}
      </td>
    );
  }

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof (value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }

}

function mapStateToProps(state) {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveSavegame: (savegameId: string) => dispatch(removeSavegame(savegameId)),
    onShowDialog:
    (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(SavegameRow) as React.ComponentClass<IBaseProps>;
