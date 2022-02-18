import React from 'react';
import { Button } from 'react-bootstrap';
import Icon from '../../../controls/Icon';

export function Overlay(props: { url: string }) {
  return (
    <div className="onboarding-overlay-content">
      <iframe
        width="100%"
        height="335"
        src={props.url}
        title="YouTube video player"
        frameBorder={0}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
      <div className='onboarding-overlay-button-container'>
        <Button className='onboarding-overlay-button'>
          <Icon
            className='onboarding-overlay-button-icon'
            name='checkbox-checked'
          />
          Mark as complete
        </Button>
      </div>
    </div>
  )
}