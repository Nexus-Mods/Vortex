import { ListGroup, ListGroupItem } from 'react-bootstrap';
import React from 'react';
import { useSelector } from 'react-redux';
import { getSafe } from '../../util/storeHelper';

import { TFunction } from '../../util/i18n';
import EnvButton from './EnvButton';

interface IConnectedProps {
  displayGroups: { [id: string]: string };
}

interface IEnvironmentProps {
  t: TFunction;
  environment: { [key: string]: string };
  onEditEnv: (itemId: string) => void;
  addEnv: (key: string, value: string) => void;
  removeEnv: (key: string) => void;
}

export default function Environment(props: IEnvironmentProps): JSX.Element {
  const { t, onEditEnv, environment, addEnv, removeEnv } = props;
  const { displayGroups } = useSelector(mapStateToProps);
  const envList = Object.keys(environment).map((key) => ({
    key,
    value: environment[key],
  }));

  const group = getSafe(displayGroups, ['envEdit'], undefined);

  const editEnv = (itemId: string) => onEditEnv(itemId);

  return (
    <ListGroup>
      {envList.map(env => (
        <ListGroupItem key={env.key}>
          <EnvButton
            t={t}
            variable={env}
            open={group === env.key}
            onAdd={addEnv}
            onRemove={removeEnv}
            onOpen={editEnv}
          />
        </ListGroupItem>
      ))}
      <ListGroupItem key='__add'>
        <EnvButton
          t={t}
          open={group === '__add'}
          onAdd={addEnv}
          onRemove={removeEnv}
          onOpen={editEnv}
        />
      </ListGroupItem>
    </ListGroup>
  );
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    displayGroups: state.session.base.displayGroups,
  };
}
