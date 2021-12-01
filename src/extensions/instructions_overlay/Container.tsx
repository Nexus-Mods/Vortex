import { IOverlay, IState } from '../../types/IState';

import { dismissOverlay } from './actions';
import InstructionsOverlay from './InstructionsOverlay';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

function Container(props: {  }) {
  const { t } = useTranslation();

  const overlays =
    useSelector<IState, { [key: string]: IOverlay }>(state => state.session.overlays.overlays);
  const dispatch = useDispatch();

  const closeOverlay = React.useCallback((key: string) => {
    dispatch(dismissOverlay(key));
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      {Object.keys(overlays).map((id) => (
        <InstructionsOverlay
          t={t}
          key={id}
          overlay={overlays[id]}
          overlayId={id}
          onClose={closeOverlay}
        />
      ))}
    </div>
  );
}

export default Container;
