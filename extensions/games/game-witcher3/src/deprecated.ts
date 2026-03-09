/*
  FBLO does not currently support individual context actions
   leaving this here for now as we may decide to enhance FBLO in
   the future.
*/
// const onSetPriority = (itemKey, wantedPriority) => {
//   return this.writeToModSettings()
//     .then(() => {
//       wantedPriority = +wantedPriority;
//       const state = context.api.store.getState();
//       const activeProfile = selectors.activeProfile(state);
//       const modId = _INI_STRUCT[itemKey].VK;
//       const loEntry = loadOrder[modId];
//       if (priorityManager.priorityType === 'position-based') {
//         context.api.store.dispatch(actions.setLoadOrderEntry(
//           activeProfile.id, modId, {
//             ...loEntry,
//             pos: (loEntry.pos < wantedPriority) ? wantedPriority : wantedPriority - 2,
//         }));
//         loadOrder = util.getSafe(state, ['persistent', 'loadOrder', activeProfile.id], {});
//       } else {
//         context.api.store.dispatch(actions.setLoadOrderEntry(
//           activeProfile.id, modId, {
//             ...loEntry,
//             prefix: parseInt(_INI_STRUCT[itemKey].Priority, 10),
//         }));
//       }
//       if (refreshFunc !== undefined) {
//         refreshFunc();
//       }
//     })
//     .catch(err => modSettingsErrorHandler(context, err,
//       'Failed to modify load order file'));
// };

// import * as React from 'react';
// import { withTranslation } from 'react-i18next';
// import { connect } from 'react-redux';
// import { ComponentEx, ToolbarIcon, types, util } from 'vortex-api';

// import { setPriorityType } from '../actions';
// import { getPriorityTypeBranch } from '../common';
// import { PriorityType } from '../priorityManager';

// interface IConnectedProps {
//   priorityType: PriorityType;
// }

// interface IActionProps {
//   onSetPriorityType: (type: string) => void;
// }

// type IProps = IConnectedProps & IActionProps;
// const TBI = ToolbarIcon as any;
// class PriorityTypeButton extends ComponentEx<IProps, {}> {
//   public render(): JSX.Element {
//     const { t, priorityType } = this.props;

//     return (
//       <TBI
//         id='switch-priority-type-button'
//         icon='sort-none'
//         text={priorityType === 'position-based' ? t('To Prefix Based') : t('To Position Based')}
//         tooltip={t('Changes priority assignment restrictions - prefix based is '
//                 + 'less restrictive and allows you to manually set priorities like '
//                 + '"5000", while position based will restrict priorities to their '
//                 + 'position in the load order page (in an incremental manner)')}
//         onClick={this.switch}
//       />
//     );
//   }

//   private switch = () => {
//     const current = this.props.priorityType;
//     this.props.onSetPriorityType((current === 'position-based')
//       ? 'prefix-based' : 'position-based');
//   }
// }

// function mapStateToProps(state: types.IState, ownProps: IProps): IConnectedProps {
//   return {
//     priorityType: util.getSafe(state, getPriorityTypeBranch(), 'prefix-based'),
//   };
// }

// function mapDispatchToProps(dispatch: any): IActionProps {
//   return {
//     onSetPriorityType: (type: string) => dispatch(setPriorityType(type)),
//   };
// }

// export default
//   withTranslation(['common', 'witcher3'])(
//     connect(mapStateToProps, mapDispatchToProps)(PriorityTypeButton as any),
//   ) as React.ComponentClass<{}>;
