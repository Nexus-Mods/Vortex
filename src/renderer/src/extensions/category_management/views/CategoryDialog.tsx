import * as React from "react";
import { useTranslation } from "react-i18next";

import Modal from "../../../controls/Modal";
import CategoryList, { CategoryListFC } from "./CategoryList";

interface IProps {
  visible: boolean;
  onHide: () => void;
}

function CategoryDialog({ visible, onHide }: IProps) {
  const { t } = useTranslation("common");

  return (
    <Modal id="categories" show={visible} onHide={() => onHide()}>
      <Modal.Header>{t("Categories")}</Modal.Header>

      <Modal.Body>
        <CategoryListFC />

        <CategoryList />
      </Modal.Body>

      <Modal.Footer>
        <div onClick={() => onHide()}>Close me</div>
      </Modal.Footer>
    </Modal>
  );
}

export default CategoryDialog;
