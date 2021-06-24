import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { FlexLayout, Icon, MainContext, tooltip, types } from 'vortex-api';
import { IOverlay, IPosition } from '../../types/IState';

interface IInstructionsOverlayProps {
  t: types.TFunction;
  overlayId: string;
  overlay: IOverlay;
  position?: IPosition;
  onClose: (id: string) => void;
}

function InstructionsOverlay(props: IInstructionsOverlayProps) {
  const { t, overlay, overlayId, position } = props;
  const context = React.useContext(MainContext);
  const [open, setOpen] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuLayer: HTMLDivElement = context['menuLayer'];
  const startPos = (position !== undefined)
    ? {
        x: (position.x / menuLayer.clientWidth) * 100,
        y: (position.y / menuLayer.clientHeight) * 100,
      }
    : { x: 80, y: 10 };
  const [pos, setPos] = React.useState(startPos);

  const toggle = React.useCallback(() => {
    setOpen(old => !old);
  }, [setOpen]);

  const updatePos = React.useCallback((evt) => {
    if (ref.current !== null) {
      ref.current.style.left = `${evt.pageX - 4}px`;
      ref.current.style.top = `${evt.pageY - 4}px`;
    }
  }, []);

  const endDrag = React.useCallback((evt) => {
    menuLayer.removeEventListener('mousemove', updatePos);
    menuLayer.removeEventListener('mouseup', endDrag);
    const { left, top } = ref.current.style;
    const newX = Math.floor((parseInt(left.replace(/px$/, ''), 10) * 1000) / menuLayer.clientWidth);
    const newY = Math.floor((parseInt(top.replace(/px$/, ''), 10) * 1000) / menuLayer.clientHeight);
    setPos({ x: newX / 10, y: newY / 10 });
    menuLayer.style.pointerEvents = 'none';
  }, [setPos]);

  const startDrag = React.useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    menuLayer.style.pointerEvents = 'initial';
    menuLayer.addEventListener('mousemove', updatePos);
    menuLayer.addEventListener('mouseup', endDrag);
    updatePos(evt);
  }, [setPos]);

  const onClose = React.useCallback(() => {
    props.onClose(overlayId);
  }, [props.onClose, overlayId]);

  return ReactDOM.createPortal([
    <div
      key={overlay.title}
      ref={ref}
      className='collection-instructions'
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      <FlexLayout type='column'>
        <FlexLayout.Fixed style={{ height: '5%' }}>
          <FlexLayout className='collection-instructions-header' type='row'>
            <FlexLayout.Fixed className='drag-icon-container' draggable onDragStart={startDrag}>
              <Icon name='drag-handle' />
            </FlexLayout.Fixed>
            <FlexLayout.Flex className='collection-instructions-title' onClick={toggle}>
              <Icon name='dialog-info' />
              <h4>{t('Instructions')}</h4>
            </FlexLayout.Flex>
            <FlexLayout.Fixed className='cllection-instructions-close'>
              <tooltip.IconButton
                className='btn-embed'
                icon='close'
                tooltip={t('Close')}
                onClick={onClose}
              />
            </FlexLayout.Fixed>
          </FlexLayout>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed className='collection-instructions-title'>
          <h3>{overlay.title}</h3>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed style={{ overflowY: 'auto' }}>
          {open
            ? (
              <ReactMarkdown
                className='collection-instructions-content'
                source={overlay.text}
              />
            )
            : null}
        </FlexLayout.Fixed>
      </FlexLayout>
    </div>,
    ],
    context['menuLayer'],
  );
}

export default InstructionsOverlay;
