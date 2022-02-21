import Dashlet from '../../controls/Dashlet';
import React from 'react';
import Icon from '../../controls/Icon';
import { IStep } from './steps';
import { useSelector } from 'react-redux';
import { IState } from '../../types/api';

export type onCardClick = (payload: onCardClickPayload) => void

export type onCardClickPayload = {
  title: string,
  video: string,
  count: number,
  desc: string,
  id: string,
  pos: { x: number, y: number }
}

function OnBoardingCard(props: {
  title: string,
  lenght: string,
  video: string,
  desc: string,
  img: string,
  count: number,
  id: string,
  onClick: onCardClick
}) {
  const { count, desc, img, lenght, onClick, title, video, id } = props

  return (
    <div className='onboarding-card' onClick={() => onClick({
      count,
      title,
      video,
      desc,
      id,
      pos: { x: window.innerWidth, y: window.innerHeight }
    })}>
      <div className='onboarding-card-image-container'>
        <img className='onboarding-card-image' src={img} alt="" />
        <Icon
          className='onboarding-card-image-play'
          name='launch-simple'
        />
      </div>
      <div className='onboarding-card-body'>
        <div className='onboarding-card-title-wrapper'>
          <span className='onboarding-card-counter'>{count}</span>
          <div className='onboarding-card-title-container'>
            <span className='onboarding-card-title'>{title}</span>
            <span className='onboarding-card-lenght'>{lenght}</span>
          </div>
        </div>
        <span className='onboarding-card-desc'>
          {desc}
        </span>
      </div>
    </div>
  )
}

function OnBoardingDashlet(props: {
  onCardClick: onCardClick,
  steps: IStep[]
}) {
  const { onCardClick, steps } = props;

  const completedSteps =  useSelector<IState, { [key: string]: boolean }>(state => (state.settings as any).onboardingsteps.steps);

  console.log(completedSteps)

  return (
    <Dashlet title='Get Started' className='dashlet-onboarding'>
      <p className='onboarding-subtitle'> Watch these 5 videos to guide you on how to start modding you favourite games. </p>
      <div className='onboarding-card-list'>
        {
          steps.map(
            (step, i) =>
              <OnBoardingCard
                id={step.id}
                title={step.title}
                desc={step.desc}
                lenght={step.lenght}
                img={step.img}
                video={step.video}
                count={i + 1}
                onClick={onCardClick} />
          )
        }
      </div>
    </Dashlet>
  );
}

export default OnBoardingDashlet