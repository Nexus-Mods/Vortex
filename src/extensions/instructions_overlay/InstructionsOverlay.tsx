import memoizeOne from 'memoize-one';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { FlexLayout, Icon, MainContext, tooltip, types } from 'vortex-api';
import { IOverlay, IPosition } from '../../types/IState';

const BORDER = 8;

interface IInstructionsOverlayProps {
  t: types.TFunction;
  overlayId: string;
  overlay: IOverlay;
  onClose: (id: string) => void;
}

const pxRE = /px$/;
function parsePos(inPos: string): number {
  return parseInt(inPos.replace(pxRE, ''), 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getContainerImpl() {
  return document.getElementById('overlays');
}

const getContainer = memoizeOne(() => getContainerImpl());

function InstructionsOverlay(props: IInstructionsOverlayProps) {
  const { t, overlay, overlayId } = props;
  const context = React.useContext(MainContext);
  const [open, setOpen] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);
  const abortDrag = React.useRef<AbortController>(null);
  const container: HTMLElement = getContainer();

  const [pos, setPosImpl] = React.useState(() => (overlay.position !== undefined)
    ? overlay.position
    : { x: container.clientWidth - 100, y: container.clientHeight - 100 });

  const dragOffset = React.useRef<IPosition>({ x: 0, y: 0 });

  React.useEffect(() => {
    if (ref.current !== undefined) {
      // fix default position as soon as the image has been rendered once
      applyPos({ ...pos });
    }
  }, [overlay, ref.current]);

  const toggle = React.useCallback(() => {
    if (!overlay?.options?.disableCollapse) {
      setOpen(old => !old);
    }
  }, [setOpen]);

  const applyPos = React.useCallback((posIn: IPosition) => {
    if (ref.current !== null) {
      posIn.x = clamp(posIn.x, BORDER, container.clientWidth - ref.current.clientWidth - BORDER);
      posIn.y = clamp(posIn.y, BORDER, container.clientHeight - ref.current.clientHeight - BORDER);
    }
    // react may not update the style if it doesn't know the dom was manipulated directly
    ref.current.style.left = `${posIn.x}px`;
    ref.current.style.top = `${posIn.y}px`;
    setPosImpl(posIn);
  }, [setPosImpl]);

  const trackMouse = React.useCallback((evt: MouseEvent) => {
    evt.preventDefault();
    if (evt.buttons === 0) {
      // missed the mouseup event? Maybe window was robbed of focus
      evt.currentTarget.dispatchEvent(new MouseEvent('mouseup'));
    } else {
      if (ref.current !== null) {
        ref.current.style.left = `${evt.pageX - dragOffset.current.x}px`;
        ref.current.style.top = `${evt.pageY - dragOffset.current.y}px`;
      }
    }
  }, [ref.current]);

  const endDrag = React.useCallback((evt: MouseEvent) => {
    abortDrag.current?.abort();
    abortDrag.current = null;

    const { left, top } = ref.current.style;
    applyPos({ x: parsePos(left), y: parsePos(top) });
    container.style.pointerEvents = 'none';
    evt.stopPropagation();
  }, [applyPos]);

  const startDrag = React.useCallback((evt: React.DragEvent<HTMLDivElement>) => {
    if (abortDrag.current !== null) {
      // something went wrong, already dragging?
      abortDrag.current.abort();
    }
    if (ref.current !== null) {
      dragOffset.current = {
        x: evt.pageX - ref.current.offsetLeft,
        y: evt.pageY - ref.current.offsetTop,
      };
    }
    container.style.pointerEvents = 'initial';
    // the mousemove event is aborted with this controller, mouseup event is canceled
    // automatically when it's triggered.
    // This is necessary because updatePos and endDrag are hook callbacks that may get updated
    // and then removeEventListener wouldn't find the correct function to remove
    abortDrag.current = new AbortController();
    // capture makes it so that the container receives the event, not the draggable icon
    container.addEventListener('mousemove', trackMouse,
      { capture: true, signal: abortDrag.current.signal });
    // only trigger endDrag once, this way we don't have to remove it manually
    container.addEventListener('mouseup', endDrag, { once: true });
    trackMouse(evt as any);
  }, [trackMouse]);

  const onClose = React.useCallback(() => {
    props.onClose(overlayId);
  }, [props.onClose, overlayId]);

  const toggleOpen = React.useCallback(() => {
    setOpen(old => !old);
  }, []);

  const className = `instructions-overlay ${overlay?.options?.className ?? ''}`;

  const overlayComponentProps = {
    ...(overlay?.options?.props?.() ?? {}),
    closeOverlay: () => props.onClose(overlayId),
  };

  return ReactDOM.createPortal([
    <div
      key={overlay.title}
      ref={ref}
      className={className}
      style={{ left: pos.x, top: pos.y }}
    >
      <FlexLayout type='column'>
        <FlexLayout.Fixed style={{ height: '5%' }}>
          <FlexLayout className='instructions-overlay-header' type='row'>
            {/*
            <FlexLayout.Fixed className='drag-icon-container' draggable onDragStart={startDrag}>
              <Icon name='drag-handle' />
            </FlexLayout.Fixed>
            */}
            <FlexLayout.Flex draggable onDragStart={startDrag} className='instructions-overlay-title'>
              {overlay?.options?.showIcon ? <Icon name='dialog-info' /> : null}
              <h4>{t(overlay?.options?.containerTitle ?? 'Instructions')}</h4>
            </FlexLayout.Flex>
            <FlexLayout.Fixed className='instructions-overlay-buttons'>
              <tooltip.IconButton
                className='btn-embed'
                icon={open ? 'collapse-overlay' : 'expand-overlay'}
                tooltip={open ? t('Collapse') : t('Expand')}
                onClick={toggleOpen}
              />
              <tooltip.IconButton
                className='btn-embed'
                icon='close'
                tooltip={t('Close')}
                onClick={onClose}
              />
            </FlexLayout.Fixed>
          </FlexLayout>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed className='instructions-overlay-mod-name'>
          {overlay.title ? <h3>{overlay.title}</h3> : null}
        </FlexLayout.Fixed>
        <FlexLayout.Fixed style={{ overflowY: 'auto' }}>
          {open
            ? typeof (overlay.content) === 'string' ?
              (
                <ReactMarkdown
                  className='instructions-overlay-content' 
                  allowedElements={['p', 'br', 'a', 'em', 'strong']} 
                  unwrapDisallowed={true}
                >
                  {overlay.content}
                </ReactMarkdown>
              )
              : <overlay.content {...overlayComponentProps} />
            : null}
        </FlexLayout.Fixed>
      </FlexLayout>
    </div>,
  ], container,
  );
}

export default InstructionsOverlay;
