import { useEffect, useRef, useCallback, DependencyList } from 'react';

export function useDebouncedCallback<T extends any[]>(callback: (...args: T) => void,
                                                      wait: number,
                                                      deps: DependencyList) {
  const argsRef = useRef<T>();
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  function cleanup() {
    if(timeout.current) {
      clearTimeout(timeout.current);
    }
  }
  useEffect(() => cleanup, []);
  return useCallback((...args: T) => {
    argsRef.current = args;
    cleanup();
    timeout.current = setTimeout(() => {
      if(argsRef.current) {
        callback(...argsRef.current);
      }
    }, wait);
  }, deps); 
}