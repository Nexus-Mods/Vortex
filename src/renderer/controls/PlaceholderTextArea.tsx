
import { FormControl, FormGroup,  InputGroup } from 'react-bootstrap';

import * as React from 'react';
import { clipboard } from 'electron';
import { MainContext } from '../views/MainWindow';
import { ContextMenu, FlexLayout, tooltip, types } from 'vortex-api';
import { StringLiteral } from 'babel-types';
import { event } from 'd3';
import { IContextPosition } from './ContextMenu';
import { findDOMNode } from 'react-dom';

export interface IPlaceholderTextAreaProps {
  t: types.TFunction;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  mModalRef: any
}

function PlaceholderTextArea(props: IPlaceholderTextAreaProps) {

  const { t, onChange, className, mModalRef } = props;

  const DEFAULT_PLACEHOLDER = 'Paste token here';

  const { api } = React.useContext(MainContext);
  const [placeholder, setPlaceholder] = React.useState(t(DEFAULT_PLACEHOLDER) as string);
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [position, setPosition] = React.useState<IContextPosition>();
  const [value, setValue] = React.useState("");

  const handlePaste = () => {
    setValue(clipboard.readText());
  }

  const onShowContext  = (event: React.MouseEvent<any>) => {    
    setShowContextMenu(true);
    const modalDom = findDOMNode(mModalRef.current) as Element;
    const rect: DOMRect = modalDom.getBoundingClientRect() as DOMRect;
    setPosition({ x: event.clientX - rect.x, y: event.clientY - rect.y });
  }

  const onHideContext = () => {    
    setShowContextMenu(false);
  }

  const handleOnChange = (event: any) => {
    setValue(event.target.value);
    onChange?.(event as React.ChangeEvent<HTMLInputElement>);        
  }

  return (
    <FormGroup controlId=''>
      <FormControl
        componentClass='textarea'
        className={className}
        placeholder={placeholder}
        onFocus={e => setPlaceholder('')} 
        onBlur={e => setPlaceholder(t(DEFAULT_PLACEHOLDER))} 
        onChange= {handleOnChange}
        onContextMenu={onShowContext}
        draggable={false}
        value={value}
      />
      <ContextMenu
        instanceId='login-context'
        visible={showContextMenu}
        position={position}
        onHide={onHideContext}
        actions={[
          { title: t('Paste'), action: handlePaste, show: true },
        ]}
      />
    </FormGroup>
  )
}

  

export default PlaceholderTextArea;