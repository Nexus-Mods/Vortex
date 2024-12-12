import React from 'react';
import { Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setOpenMainPage } from '../../actions';
import Dashlet from '../../controls/Dashlet';
import Icon from '../../controls/Icon';
import { IState } from '../../types/api';
import { setDashletEnabled } from '../dashboard/actions';
import { resetSteps } from './actions';
import { IStep } from './steps';

export type OnCardClick = (payload: IOnCardClickPayload) => void;

export interface IOnCardClickPayload {
  title: string;
  video: string;
  desc: string;
  id: string;
  pos: { x: number, y: number };
}

function OnBoardingCard(props: {
  title: string,
  length: string,
  video: string,
  desc: string,
  img: string,
  count: number,
  id: string,
  isCompleted: boolean,
  onClick: OnCardClick,
}) {
  const { t } = useTranslation();

  const { count, desc, img, length, onClick, title, video, id, isCompleted } = props;

  const openModal = () => {
    onClick({
      title,
      video,
      desc,
      id,
      pos: { x: window.innerWidth, y: window.innerHeight },
    });
  };

  return (
    <div className='onboarding-card' onClick={openModal}>
      <div className='onboarding-card-image-container'>
        <img className='onboarding-card-image' src={img} alt='' />
      </div>
      <div className='onboarding-card-body'>
        <div className='onboarding-card-title-wrapper'>
          <CounterWithCheckbox count={count} isChecked={isCompleted} />
          <div className='onboarding-card-title-container'>
            <span className='onboarding-card-title'>{t(title)}</span>
            <span className='onboarding-card-length'>{length}</span>
          </div>
        </div>
        <span className='onboarding-card-desc'>
          {t(desc)}
        </span>
      </div>
    </div>
  );
}

function CounterWithCheckbox(props: { isChecked: boolean, count: number }) {
  const { count, isChecked } = props;
  const className = `onboarding-card-counter ${isChecked
    ? 'onboarding-card-counter--checked'
    : ''}`;

  return (
    <span className={className}>
      {isChecked
        ? <Icon
          className='onboarding-card-counter-checked-icon'
          name='completed'
        />
        : count}
    </span>
  );
}

function OnBoardingDashletWrapper(props: {
  onCardClick: OnCardClick,
  steps: IStep[],
  getMoreMods: () => {},
}) {
  const { onCardClick, steps, getMoreMods } = props;
  const { t } = useTranslation();
  const completedSteps = useSelector<IState, { [key: string]: boolean }>
    (state => (state.settings as any).onboardingsteps.steps);

  const completedStepsValues = Object.values(completedSteps);

  const isFullyCompleted =
    steps.length === completedStepsValues.length
    && completedStepsValues.every((x) => x === true);
  return (
    <>
      {
        isFullyCompleted
          ? <CompletedOnBoardingDashlet getMoreMods={getMoreMods} />
          : <Dashlet title={t('Get Started')} className='dashlet-onboarding'>
            <p className='onboarding-subtitle'>
              {t('Watch these videos to guide you on how to start modding your favorite games.')}
            </p>
            <div className='onboarding-card-list'>
              {
                steps.map(
                  (step, i) =>
                    <OnBoardingCard
                      key={i}
                      id={step.id}
                      title={step.title}
                      desc={step.desc}
                      length={step.length}
                      img={step.img}
                      video={step.video}
                      count={i + 1}
                      onClick={onCardClick}
                      isCompleted={completedSteps[step.id]}
                    />,
                )
              }
            </div>
          </Dashlet>
      }
    </>
  );
}

function CompletedOnBoardingDashlet(props: {getMoreMods: () => {}}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const closeDashlet = () => {
    dispatch(setDashletEnabled('Onboarding', false));
  };

  const resetAllSteps = () => {
    dispatch(resetSteps());
  };

  return (
    <Dashlet title='' className='dashlet-onboarding-completed'>
      <div className='onboarding-completed-header'>
        <h1>
          &#127881; {t('Congratulations, you\'ve made it!')}
        </h1>
        <h4>
          {t('Now you are all set up to enjoy Vortex and start modding!')}
        </h4>
      </div>
      <div className='onboarding-completed-body'>
        <div className='onboarding-completed-body-button'>
          <Button
            id='btn-more-mods'
            onClick={props.getMoreMods}
          >
            <Icon name={'nexus'} />
            {t('Get more mods')}
          </Button>
        </div>
        <div className='onboarding-completed-body-links'>
          <a onClick={resetAllSteps}>{t('Watch again')}</a>
          <a onClick={closeDashlet}>{t('Hide')}</a>
        </div>
      </div>
    </Dashlet>
  );
}

export default OnBoardingDashletWrapper;
