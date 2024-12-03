import Modal from '../../../controls/Modal';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import DNDContainer from '../../../views/DNDContainer';

import { showCategoriesDialog } from '../actions/session';

import CategoryList from './CategoryList';

import * as React from 'react';
import * as Redux from 'redux';

interface IConnectedProps {
  showDialog: boolean;
}

interface IActionProps {
  onShowSelf: (show: boolean) => void;
}

type IProps = IConnectedProps & IActionProps;

class CategoryDialog extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, showDialog } = this.props;

    return (
      <Modal show={showDialog} onHide={this.hide}>
        <Modal.Header>
          <Modal.Title>{t('Categories')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <CategoryList />
        </Modal.Body>
      </Modal>
    );
  }

  private hide = () => {
    this.props.onShowSelf(false);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    showDialog: state.session.categories.showDialog,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onShowSelf: (show: boolean) =>
      dispatch(showCategoriesDialog(show)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      CategoryDialog)) as React.ComponentClass<{}>;
