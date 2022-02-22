import React from 'react';
import { Button } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import Icon from '../../../controls/Icon';
import { completeStep } from '../actions';

export function Overlay(props: { url: string, id: string, closeOverlay: () => void }) {
  const { url, id, closeOverlay } = props;

  const dispatch = useDispatch();

  const onCompleteStep = () => {
    dispatch(completeStep(id));
    closeOverlay();
  };

  return (
    <div className='onboarding-overlay-content'>
      <iframe
        width='100%'
        height='335'
        src={url}
        title='YouTube video player'
        frameBorder={0}
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
        allowFullScreen
      />
      <div className='onboarding-overlay-button-container'>
        <Button className='onboarding-overlay-button' onClick={onCompleteStep}>
          <Icon
            className='onboarding-overlay-button-icon'
            name='completed'
          />
          Mark as complete
        </Button>
      </div>
    </div>
  );
}
