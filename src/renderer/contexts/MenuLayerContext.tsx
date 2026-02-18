import React, {
  createContext,
  type ReactNode,
  type FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface IMenuLayerContext {
  menuLayerElement: HTMLDivElement | null;
  menuLayerOpen: boolean;
  setMenuLayerRef: (ref: HTMLDivElement | null) => void;
}

const defaultValue: IMenuLayerContext = {
  menuLayerElement: null,
  menuLayerOpen: false,
  setMenuLayerRef: () => {},
};

const MenuLayerContext = createContext<IMenuLayerContext>(defaultValue);

export interface IMenuLayerProviderProps {
  children: ReactNode;
}

export const MenuLayerProvider: FC<IMenuLayerProviderProps> = ({
  children,
}) => {
  const [menuLayerOpen, setMenuLayerOpen] = useState(false);
  const [menuLayerElement, setMenuLayerElement] =
    useState<HTMLDivElement | null>(null);
  const menuObserverRef = useRef<MutationObserver | undefined>(undefined);

  const setMenuLayerRef = useCallback((ref: HTMLDivElement | null) => {
    if (menuObserverRef.current !== undefined) {
      menuObserverRef.current.disconnect();
      menuObserverRef.current = undefined;
    }

    setMenuLayerElement(ref);

    if (ref !== null) {
      let hasChildren = ref.children.length > 0;
      setMenuLayerOpen(hasChildren);

      menuObserverRef.current = new MutationObserver(() => {
        const newHasChildren = ref.children.length > 0;
        if (newHasChildren !== hasChildren) {
          hasChildren = newHasChildren;
          setMenuLayerOpen(hasChildren);
        }
      });

      menuObserverRef.current.observe(ref, { childList: true });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (menuObserverRef.current !== undefined) {
        menuObserverRef.current.disconnect();
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      menuLayerElement,
      menuLayerOpen,
      setMenuLayerRef,
    }),
    [menuLayerElement, menuLayerOpen, setMenuLayerRef],
  );

  return (
    <MenuLayerContext.Provider value={contextValue}>
      {children}
    </MenuLayerContext.Provider>
  );
};

export const MenuLayerConsumer = MenuLayerContext.Consumer;

export function useMenuLayerContext(): IMenuLayerContext {
  return useContext(MenuLayerContext);
}
