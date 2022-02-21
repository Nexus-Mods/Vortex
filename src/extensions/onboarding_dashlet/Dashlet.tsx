import Dashlet from '../../controls/Dashlet';
import React from 'react';
import Icon from '../../controls/Icon';
import { IStep } from './steps';
import { useSelector } from 'react-redux';
import { IState } from '../../types/api';
import { Button } from 'react-bootstrap';

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
  isCompleted: boolean,
  onClick: onCardClick
}) {
  const { count, desc, img, lenght, onClick, title, video, id, isCompleted } = props

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
      </div>
      <div className='onboarding-card-body'>
        <div className='onboarding-card-title-wrapper'>
          <CounterWithCheckbox count={count} isChecked={isCompleted} />
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

function CounterWithCheckbox(props: { isChecked: boolean, count: number }) {
  const { count, isChecked } = props;
  const className = `onboarding-card-counter ${isChecked ? 'onboarding-card-counter--checked' : ''}`
  return (
    <span className={className}>
      {isChecked
        ? <Icon
          className='onboarding-card-counter-checked-icon'
          name='completed' />
        : count}
    </span>
  )
}

function OnBoardingDashletWrapper(props: {
  onCardClick: onCardClick,
  steps: IStep[]
}) {
  const { onCardClick, steps } = props;

  const completedSteps = useSelector<IState, { [key: string]: boolean }>(state => (state.settings as any).onboardingsteps.steps);

  const completedStepsValues = Object.values(completedSteps)

  const isFullyCompleted = steps.length == completedStepsValues.length && completedStepsValues.every((x) => x === true)

  return (
    <>
      {
        isFullyCompleted
          ? <CompletedOnBoardingDashlet />
          : <Dashlet title='Get Started' className='dashlet-onboarding'>
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
                      onClick={onCardClick}
                      isCompleted={completedSteps[step.id]} />
                )
              }
            </div>
          </Dashlet>
      }
    </>
  );
}

function OnboardingCompletedCard(props: { title, desc, icon, button }) {
  return (
    <div className='onboarding-card onboarding-card--completed'>
      <div className='onboarding-completed-card-header'>
        <Icon
          className='onboarding-completed-card-header-icon'
          name={props.icon} />
        <span className='onboarding-completed-card-header-text'>
          {props.title}
        </span>
      </div>
      <span className='onboarding-completed-card-desc'>
        {props.desc}
      </span>
      <Button className='onboarding-completed-card-button'>
        {props.button}
      </Button>
    </div>
  )
}

function CompletedOnBoardingDashlet() {
  return (
    <Dashlet title='' className='dashlet-onboarding-completed'>
      <div className='onboarding-completed-header'>
        <h2>
          🎉 Congratulation! You've made it!
        </h2>
        <h4>
          Now you are all setup to enjoy Vortex and start modding!
        </h4>
      </div>
      <div className='onboarding-completed-body'>
        <OnboardingCompletedCard title={'Say thank you'} icon='endorse-yes' button={'Endorse'} desc='Show your appreciation to the authors by endorsing their mods.'/>
        <OnboardingCompletedCard title={'Check out collections'} icon='collection' button={'View Collections'} desc='Collections allow you to download large combinations of mods that work together'/>
      </div>
    </Dashlet>
  )
}

export default OnBoardingDashletWrapper