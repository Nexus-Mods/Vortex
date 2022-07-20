import React from 'react';
import { Button, Checkbox } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../controls/api';

import { activeGameId } from '../../../util/selectors';
import { useSelector } from 'react-redux';
import { renderModName } from '../../../util/api';

export interface IDuplicatesMap {
  duplicates: { [modName: string]: string[] };
  preselected: string[];
}

export interface IRemoveDuplicateMap { [modId: string]: string }

interface IBaseProps {
  visible: boolean;
  onHide: () => void;
  onGetDuplicates: () => IDuplicatesMap;
  onRemoveMods: (remove: IRemoveDuplicateMap) => void;
  openDuplicateLocation: (modId: string) => void;
  getModInfo: (gameMode: string, modId: string) => string,
}

export default function DuplicatesDialog(props: IBaseProps) {
  const { visible, onHide, onGetDuplicates, onRemoveMods, openDuplicateLocation, getModInfo } = props;
  const [t] = useTranslation();
  const gameMode = useSelector(activeGameId);
  const [checked, setChecked] = React.useState([]);
  const [duplicates, setDuplicates] = React.useState({});
  const onSetChecked = React.useCallback((modId: string) => {
    const newState = (checked.includes(modId))
      ? checked.filter(id => id !== modId)
      : [].concat(checked, modId);
    setChecked(newState);
  }, [checked, setChecked]);

  const removeMods = React.useCallback(() => {
    const removeMap = checked.reduce((accum, iter) => {
      const modName = Object.keys(duplicates).find(id => duplicates[id].includes(iter));
      accum[iter] = duplicates[modName].find(id => !checked.includes(id));
      return accum;
    }, {});
    onRemoveMods(removeMap);
    onHide()
  }, [checked, duplicates, onHide, onRemoveMods])

  React.useEffect(() => {
    const duplicateData = onGetDuplicates();
    if (duplicateData !== undefined) {
      setDuplicates(duplicateData.duplicates);
      setChecked(duplicateData.preselected);
    }
    return () => {
      setDuplicates({});
      setChecked([]);
    }
  }, [gameMode]);

  const getInfo = React.useCallback((modId) => {
    return getModInfo(gameMode, modId)
  }, [getModInfo, gameMode]);

  const renderDuplicates = Object.keys(duplicates).map((name, idx) => {
    return (
      <DuplicateSegment
        key={name + idx}
        checked={checked}
        entries={duplicates[name]}
        modName={name}
        onSetCheckbox={onSetChecked}
        getModInfo={getInfo}
        openDuplicateLocation={openDuplicateLocation}
      />
    )
  })

  const paragraph = t('Vortex may have pre-selected some of the mods for you '
    + '(if they were not referenced by any of your profiles) It\'s always a good '
    + 'idea to double check the mod itself in the staging folder before removing '
    + 'anything. The selected mods will be removed.')

  return (<Modal show={visible} onHide={onHide}>
    <Modal.Header>
      <Modal.Title>{t('Choose Duplicates')}</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      {paragraph}
      {renderDuplicates}
    </Modal.Body>
    <Modal.Footer>
      <Button onClick={onHide}>{t('Cancel')}</Button>
      <Button onClick={removeMods}>{t('Remove Duplicates')}</Button>
    </Modal.Footer>
  </Modal>
  );
}

interface ISegmentProps {
  modName: string;
  entries: string[];
  checked: string[];
  onSetCheckbox: (modId: string) => void;
  openDuplicateLocation: (modId: string) => void;
  getModInfo: (modId: string) => string,
}

function DuplicateSegment(props: ISegmentProps) {
  const { modName, entries, checked, onSetCheckbox, openDuplicateLocation, getModInfo } = props;
  const [modData, setModData] = React.useState({});
  const onChange = React.useCallback((evt) => {
    const modId: string = evt.target.value;
    onSetCheckbox(modId);
  }, [onSetCheckbox]);
  const onOpenFolder = React.useCallback((evt) => {
    const modId = evt.target.getAttribute('data-id');
    openDuplicateLocation(modId);
  }, [openDuplicateLocation]);
  React.useEffect(() => {
    const data = entries.reduce((accum, iter) => {
      accum[iter] = getModInfo(iter);
      return accum;
    }, {});
    setModData(data);
    return () => {
      setModData({})
    };
  }, [entries]);
  return (
    <div>
      <h5>{modName}</h5>
      {entries.map((modId, idx) => (
        <div key={modId + idx}>
          <a data-id={modId} onClick={onOpenFolder}>{modId}</a>
          <Checkbox
            key={modId}
            checked={checked.includes(modId)}
            value={modId}
            onChange={onChange}
          >
            {modData[modId]}
          </Checkbox>
        </div>
      ))}
    </div>
  );
}
