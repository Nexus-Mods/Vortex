import { FormControl, FormGroup, InputGroup } from 'react-bootstrap';

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
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  mModalRef: any;
  value?: string; // Add value prop to make it properly controlled
}

function PlaceholderTextArea(props: IPlaceholderTextAreaProps) {

  const { t, onChange, className, mModalRef, value } = props;

  const DEFAULT_PLACEHOLDER = 'Paste token here';

  const { api } = React.useContext(MainContext);
  const [placeholder, setPlaceholder] = React.useState(t(DEFAULT_PLACEHOLDER) as string);
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [position, setPosition] = React.useState<IContextPosition>();
  const [internalValue, setInternalValue] = React.useState(value || ""); // Use internal state

  // Sync internal value with prop value
  React.useEffect(() => {
    if (value !== undefined && value !== internalValue) {
      setInternalValue(value || "");
    }
  }, [value, internalValue]);

  const handlePaste = () => {
    const clipboardText = clipboard.readText();
    setInternalValue(clipboardText);
    if (onChange) {
      const event = {
        target: { value: clipboardText }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(event);
    }
  }

  const onShowContext = (event: React.MouseEvent<any>) => {
    setShowContextMenu(true);
    const modalDom = findDOMNode(mModalRef.current) as Element;
    const rect: DOMRect = modalDom.getBoundingClientRect() as DOMRect;
    setPosition({ x: event.clientX - rect.x, y: event.clientY - rect.y });
  }

  const onHideContext = () => {
    setShowContextMenu(false);
  }

  const handleOnChange = (event: React.FormEvent<FormControl>) => {
    const target = event.target as HTMLTextAreaElement;
    const newValue = target.value;
    setInternalValue(newValue);
    if (onChange) {
      const customEvent = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(customEvent);
    }
  }

  return (
    <FormGroup controlId=''>
      <FormControl
        componentClass='textarea'
        className={className}
        placeholder={placeholder}
        onFocus={e => setPlaceholder('')}
        onBlur={e => setPlaceholder(t(DEFAULT_PLACEHOLDER))}
        onChange={handleOnChange}
        onContextMenu={onShowContext}
        draggable={false}
        value={internalValue} // Use internal state value
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