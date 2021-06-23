import React from 'react';
import Redux from 'redux';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { IOverlay, IPosition, IState } from '../../types/IState';
import MainPage from '../../views/MainPage';
import InstructionsOverlay from './InstructionsOverlay';
import { dismissOverlay } from './actions';

function Container(props: {  }) {
  const { t } = useTranslation();

  const overlays = useSelector<IState>(state => state.session.overlays.overlays);
  const dispatch = useDispatch();

  const closeOverlay = React.useCallback((key: string) => {
    dispatch(dismissOverlay(key));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      {Object.keys(overlays).map((id) => (
        <InstructionsOverlay
          t={t}
          overlay={overlays[id]}
          overlayId={id}
          position={overlays[id]?.position}
          onClose={closeOverlay}
        />
      ))}
    </div>
  )
}

export default Container;
