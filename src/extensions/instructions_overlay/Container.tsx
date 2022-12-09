import { IOverlay, IState } from '../../types/IState';

import InstructionsOverlay from './InstructionsOverlay';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

function Container(props: { onClose: (id: string) => void }) {
  const { t } = useTranslation();

  const overlays =
    useSelector<IState, { [key: string]: IOverlay }>(state => state.session.overlays.overlays);

  const closeOverlay = React.useCallback((key: string) => {
    props.onClose(key);
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
