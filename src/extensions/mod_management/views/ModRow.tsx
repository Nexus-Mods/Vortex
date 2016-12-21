import { showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IIconDefinition } from '../../../types/IIconDefinition';
import getAttr from '../../../util/getAttr';
import IconBar from '../../../views/IconBar';

import { connect } from '../../../util/ComponentEx';

import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod } from '../actions/mods';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as React from 'react';
import { Checkbox } from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  mod: IMod;
  modState: IProfileMod;
  attributes: IModAttribute[];
  language: string;
  onSetModEnabled: (modId: string, enabled: boolean) => void;
  onClick: React.MouseEventHandler<any>;
  selected: boolean;
}

interface IActionProps {
  onRemoveMod: (modId: string) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IActionProps;

class ModRow extends React.Component<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  private modActions: IIconDefinition[];

  constructor(props) {
    super(props);

    this.modActions = [
      {
        icon: 'remove',
        title: 'Remove',
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {
    const { attributes, mod, modState, onClick, selected } = this.props;

    let classes = ['mod-' + mod.state];
    if (selected) {
      classes.push('modlist-selected');
    }

    return (
      <tr
        id={mod.id}
        key={mod.id}
        className={classes.join(' ')}
        onClick={onClick}
      >
        <td>
          <Checkbox
            checked={getAttr(modState, 'enabled', false)}
            onChange={this.setModEnabled}
          />
        </td>
        {attributes.map(this.renderAttribute)}
        <td style={{ textAlign: 'center' }}>
          <IconBar
            group='mod-action-icons'
            instanceId={ mod.id }
            className='table-actions'
            staticElements={ this.modActions }
          />
        </td>
      </tr>
    );
  }

  private remove = () => {
    const { mod, onRemoveMod, onShowDialog } = this.props;
    if (mod.installationPath) {
      let removeMod = true;
      let removeArchive = false;
      let disableDependent = false;
      onShowDialog('question', 'Confirm Removal', {
        checkboxes: [
          { id: 'mod', text: 'Remove Mod', value: true },
          { id: 'archive', text: 'Remove Archive', value: false },
          { id: 'dependents', text: 'Disable Dependent', value: false },
        ],
      }, {
          Cancel: null,
          Remove: null,
        }).then((result: IDialogResult) => {
          removeMod = result.action === 'Remove' && result.input.mod;
          removeArchive = result.action === 'Remove' && result.input.archive;
          disableDependent = result.action === 'Remove' && result.input.dependents;
          if (removeMod) {
            return fs.removeAsync(mod.installationPath);
          } else {
            return Promise.resolve();
          }
        })
        .then(() => {
          if (removeMod) {
            onRemoveMod(mod.id);
          }
          if (removeArchive) {
            this.context.api.events.emit('remove-download', mod.archiveId);
          }
        });
    } else {
      onRemoveMod(mod.id);
    }
  }

  private renderAttribute = (attribute: IModAttribute): JSX.Element => {
    const { t, mod } = this.props;
    return (
      <td key={ attribute.id }>
      {this.renderCell(attribute.calc(mod.attributes, t))}
      </td>
    );
  }

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof(value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }

  private setModEnabled = (evt: React.MouseEvent<any>) => {
    const { mod, onSetModEnabled } = this.props;
    onSetModEnabled(mod.id, (evt.target as HTMLInputElement).checked);
  }
}

function mapStateToProps(state) {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveMod: (modId: string) => dispatch(removeMod(modId)),
    onShowDialog:
      (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(ModRow) as React.ComponentClass<IBaseProps>;
