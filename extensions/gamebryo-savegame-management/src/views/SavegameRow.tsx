import { removeSavegame } from '../actions/session';
import { ISavegame } from '../types/ISavegame';
import { ISavegameAttribute } from '../types/ISavegameAttribute';
import { savesPath } from '../util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {IconBar, actions, types} from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { connect } from 'react-redux';

export interface IBaseProps {
  save: ISavegame;
  attributes: ISavegameAttribute[];
  language: string;
  onClick: React.MouseEventHandler<any>;
  selected: boolean;
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  savesPath: string;
}

interface IActionProps {
  onRemoveSavegame: (savegameId: string) => void;
  onShowDialog: (type: types.DialogType, title: string, content: types.IDialogContent,
    actions: types.DialogActions) => Promise<types.IDialogResult>;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class SavegameRow extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: types.IComponentContext;

  private savegameActions: types.IIconDefinition[];

  constructor(props) {
    super(props);

    this.savegameActions = [
      {
        icon: 'remove',
        title: props.t('Delete'),
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
    const { t, savesPath, save, onRemoveSavegame, onShowDialog } = this.props;

    let removeSavegame = true;

    onShowDialog('question', t('Confirm deletion'), {
      message: t('Do you really want to remove {{saveId}}?', { replace: { saveId: save.id } }),
      translated: true,
    }, {
        Cancel: null,
        Delete: null,
      }).then((result: types.IDialogResult) => {
        removeSavegame = result.action === 'Delete';
        if (removeSavegame) {
          return fs.removeAsync(path.join(savesPath, save.id));
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

function mapStateToProps(state): IConnectedProps {
  return {
    savesPath: savesPath(state.settings.gameMode.current),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveSavegame: (savegameId: string) => dispatch(removeSavegame(savegameId)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(SavegameRow) as React.ComponentClass<IBaseProps>;
