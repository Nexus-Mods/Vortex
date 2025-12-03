import React from 'react';
import { Button } from 'react-bootstrap';
import { useDispatch } from 'react-redux';
import Icon from '../../../renderer/controls/Icon';
import { completeStep } from '../actions';
import { useTranslation } from 'react-i18next';

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
      <iframe
        {...{
          src: url,
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox',
          width: '100%',
          height: '335',
          referrerPolicy: 'strict-origin-when-cross-origin',
          allow: 'encrypted-media; web-share; fullscreen',
          title: 'YouTube video player',
          style: { border: 0 },
          allowFullScreen: true,
        } as any}
      />
      <p className='youtube-privacy-notice'>{t('Playing this video will store cookies on your device')}</p>
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
