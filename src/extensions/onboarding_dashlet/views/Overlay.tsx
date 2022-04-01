import React from 'react';
import { Button } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import Icon from '../../../controls/Icon';
import Webview from '../../../controls/Webview';
import opn from '../../../util/opn';
import { completeStep } from '../actions';

const onNewWindow = (ytUrl: string) => {
  // Small hack to avoid blank page when clicking the subscibe button
  // the blank page is: `https://www.youtube.com/post_login`
  ytUrl = ytUrl.indexOf('https://www.youtube.com/signin?') >= 0
    ? 'https://www.youtube.com/channel/UCHkIcWk6R4p_O56foC-ISsw'
    : ytUrl;
  opn(ytUrl).catch(() => null);
};

export function Overlay(props: { url: string, id: string, closeOverlay: () => void }) {
  const { url, id, closeOverlay } = props;

  const dispatch = useDispatch();

  const onCompleteStep = () => {
    dispatch(completeStep(id));
    closeOverlay();
  };

  return (
    <div className='onboarding-overlay-content'>
      <Webview
        style={{width: '100%', height: 335}}
        src={url}
        onNewWindow={onNewWindow}
        title='YouTube video player'
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
