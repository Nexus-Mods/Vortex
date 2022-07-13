import React from 'react';
import { IconButton } from '../../controls/TooltipControls';
import { FormControl, InputGroup } from 'react-bootstrap';
import { TFunction } from '../../util/i18n';
import { getSafe } from '../../util/storeHelper';

interface IEnvButtonProps {
  t: TFunction;
  variable?: { key: string, value: string };
  open: boolean;
  onOpen: (itemId: string) => void;
  onRemove: (key: string) => void;
  onAdd: (key: string, value: string) => void;
}

export default function EnvButton(props: IEnvButtonProps) {
  const { t, variable, open, onAdd, onOpen, onRemove } = props;
  const [varCopy, setVarCopy] = React.useState({ ...variable });
  React.useEffect(() => {
    setVarCopy({ ...variable });
  }, [variable]);

  const editKey = React.useCallback((evt: React.FormEvent<any>) => {
    setVarCopy({ ...varCopy, key: evt.currentTarget.value });
  }, [varCopy]);

  const editValue = React.useCallback((evt: React.FormEvent<any>) => {
    setVarCopy({ ...varCopy, value: evt.currentTarget.value });
  }, [varCopy]);

  const apply = React.useCallback(() => {
    if (variable !== undefined) {
      onRemove(variable.key);
    }
    if ((varCopy.key !== undefined) && (varCopy.key.length > 0)) {
      onAdd(varCopy.key, varCopy.value);
    }
    onOpen(undefined);
  }, [variable, varCopy, onAdd, onOpen, onRemove]);

  const openClick = React.useCallback(() => {
    onOpen(variable?.key !== undefined ? variable.key : '__add');
  }, [onOpen, variable]);

  const key = getSafe(varCopy, ['key'], '');
  const remove = React.useCallback(() => {
    onRemove(key);
  }, [onRemove, key]);

  if (open) {
    return (
      <InputGroup>
        <FormControl
          type='text'
          value={key}
          onChange={editKey}
          placeholder={t('Key')}
          style={{ width: '50%' }}
        />{' '}
        <FormControl
          type='text'
          value={getSafe(varCopy, ['value'], '')}
          onChange={editValue}
          placeholder={t('Value')}
          style={{ width: '50%' }}
        />
        <InputGroup.Button>
          <IconButton
            id={`btn-apply-${key}`}
            icon='input-confirm'
            tooltip={t('Apply')}
            onClick={apply}
          />
        </InputGroup.Button>
      </InputGroup>
    );
  } else {
    if (variable?.key === undefined) {
      return (
        <IconButton
          id='btn-add-env'
          icon='add'
          tooltip={t('Add')}
          onClick={openClick}
        />
      );
    } else {
      return (
        <div className='env-kvpair'>
          <div>
            <b>{varCopy.key}</b> = <b>{varCopy.value}</b>
          </div>
          <div className='env-edit-buttons'>
            <IconButton
              id={`btn-edit-${varCopy.key}`}
              icon='edit'
              tooltip={t('Edit')}
              onClick={openClick}
            />
            <IconButton
              id={`btn-remove-${varCopy.key}`}
              icon='remove'
              tooltip={t('Remove')}
              onClick={remove}
            />
          </div>
        </div>
      );
    }
  }
}