
import { FormControl, FormGroup,  InputGroup } from 'react-bootstrap';

import * as React from 'react';
import { IconButton } from './TooltipControls';
import { clipboard } from 'electron';
import { MainContext } from '../views/MainWindow';

export interface ICopyClipboardInputProps {
  inputValue: string;
}

function CopyClipboardInput(props: ICopyClipboardInputProps) {
  
  const { api } = React.useContext(MainContext);
  const [ showElement, setShowElement ] = React.useState(false);

  const handleButtonClick = () => {    
    
    try {
      clipboard.writeText(props.inputValue);

      // show confirmation text
      setShowElement(true);

      // hide after 3 seconds
      setTimeout(() => {
        setShowElement(false);
      }, 3000);

    } catch (err) {
      // apparently clipboard gets lazy-loaded and that load may fail for some reason
      api.showErrorNotification('Failed to access clipboard', err, { allowReport: false });
    }
  }

  return (
    <FormGroup>            
      <InputGroup>
        <FormControl
          type='text'
          value={props.inputValue}
          readOnly />
        <InputGroup.Addon>
          <IconButton
            className='btn-embed'
            icon='clipboard-copy'
            tooltip={'Copy to clipboard'}
            onClick={handleButtonClick} />
        </InputGroup.Addon>
      </InputGroup>
      <p className='login-copy-to-clipboard' style={{visibility: showElement?'visible':'hidden'}}>&#x2713; Copied to clipboard</p>
    </FormGroup>
  )
}

export default CopyClipboardInput;
