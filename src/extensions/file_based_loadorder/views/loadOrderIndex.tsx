import React, { useState } from 'react';
import { ILoadOrderEntry } from '../../../types/api';
import { IExtensionApi, LoadOrder } from '../../../types/api';

interface IProps {
  className?: string;
  api: IExtensionApi;
  item: ILoadOrderEntry;
  loadOrder: LoadOrder;
  currentPosition: number;
  lockedEntriesCount: number;
  isLocked: (item: ILoadOrderEntry) => boolean
  onApplyIndex: (idx: number) => void;
}

export function LoadOrderIndexInput(props: IProps) {
  const { item, loadOrder, currentPosition, lockedEntriesCount, onApplyIndex } = props;

  // Valid ranges.
  const startIndex = lockedEntriesCount + 1;
  const maxIndex = loadOrder.length;

  const [inputValue, setInputValue] = useState(currentPosition.toString());

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // Meant to be used as validation only.
    try {
      const newIndex = parseInt(event.target.value, 10);
      setInputValue(newIndex.toString());
    } catch (err) {
      setInputValue(currentPosition.toString());
    }
  }, [currentPosition, maxIndex, startIndex]);

  const handleKeyPress = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Apply new index
      let newIndex = parseInt(inputValue, 10);
      newIndex = Math.max(startIndex, Math.min(maxIndex, newIndex));
      onApplyIndex(newIndex);
      setInputValue(newIndex.toString());
    }
    if (event.key === 'Escape') {
      // reset
      setInputValue(currentPosition.toString());
    }
  }, [currentPosition, maxIndex, startIndex, inputValue]);

  const handleBlur = React.useCallback(() => {
    // User moved away from the input, reset the index.
    setInputValue(currentPosition.toString());
  }, [currentPosition]);

  React.useEffect(() => {
    setInputValue(currentPosition.toString());
  }, [currentPosition]);

  return props.isLocked(item) ? (
    <p className={props.className}>{inputValue}</p>
  ) : (
    <div className={props.className}>
      <input
        type='number'
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyPress}
        onBlur={handleBlur}
        min={startIndex}
        max={maxIndex}
      />
    </div>
  );
}
