import React from 'react';
import { Button } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import Icon from '../../../controls/Icon';
import Webview from '../../../controls/Webview';
import opn from '../../../util/opn';
import { completeStep } from '../actions';
import { useTranslation } from 'react-i18next';
const onNewWindow = (ytUrl: string) => {
  // Small hack to avoid blank page when clicking the subscibe button
  // the blank page is: `https://www.youtube.com/post_login`
  ytUrl = ytUrl.indexOf('https://www.youtube.com/signin?') >= 0
    ? 'https://www.youtube.com/channel/UCHkIcWk6R4p_O56foC-ISsw'
    : ytUrl;
  opn(ytUrl).catch(() => null);
};

export function Overlay(props: {
  url: string,
  id: string,
  desc: string,
  isCompleted: boolean,
  closeOverlay: () => void
}) {
  const { url, id, closeOverlay, desc, isCompleted } = props;
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const onCompleteStep = () => {
    dispatch(completeStep(id));
    closeOverlay();
  };

  return (
    <div className='onboarding-overlay-content'>
      <p>
        {desc}
      </p>
      <Webview
        style={{ width: '100%', height: 335 }}
        src={`${url}?autoplay=1`}
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
          {isCompleted ? t('Completed') : t('Mark as complete')}
        </Button>
      </div>
    </div>
  );
}
