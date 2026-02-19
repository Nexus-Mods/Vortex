import { clipboard } from "electron";
import * as React from "react";
import { FormControl, FormGroup } from "react-bootstrap";
import { findDOMNode } from "react-dom";

import type { TFunction } from "../util/i18n";

import { MainContext } from "../views/MainWindow";
import ContextMenu, { type IContextPosition } from "./ContextMenu";

export interface IPlaceholderTextAreaProps {
  t: TFunction;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  mModalRef: any;
}

function PlaceholderTextArea(props: IPlaceholderTextAreaProps) {
  const { t, onChange, className, mModalRef } = props;

  const DEFAULT_PLACEHOLDER = "Paste token here";

  const { api } = React.useContext(MainContext);
  const [placeholder, setPlaceholder] = React.useState(() =>
    t(DEFAULT_PLACEHOLDER),
  );
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const [position, setPosition] = React.useState<IContextPosition>();
  const [value, setValue] = React.useState("");

  const handlePaste = () => {
    setValue(clipboard.readText());
  };

  const onShowContext = (event: React.MouseEvent<any>) => {
    setShowContextMenu(true);
    const modalDom = findDOMNode(mModalRef.current) as Element;
    const rect: DOMRect = modalDom.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.x, y: event.clientY - rect.y });
  };

  const onHideContext = () => {
    setShowContextMenu(false);
  };

  const handleOnChange = (event: any) => {
    setValue(event.target.value);
    onChange?.(event as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <FormGroup controlId="">
      <FormControl
        className={className}
        componentClass="textarea"
        draggable={false}
        placeholder={placeholder}
        value={value}
        onBlur={(e) => setPlaceholder(t(DEFAULT_PLACEHOLDER))}
        onChange={handleOnChange}
        onContextMenu={onShowContext}
        onFocus={(e) => setPlaceholder("")}
      />

      <ContextMenu
        actions={[{ title: t("Paste"), action: handlePaste, show: true }]}
        instanceId="login-context"
        position={position}
        visible={showContextMenu}
        onHide={onHideContext}
      />
    </FormGroup>
  );
}

export default PlaceholderTextArea;
