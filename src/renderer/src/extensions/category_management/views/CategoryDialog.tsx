import * as React from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "@/ui/components/modal/Modal";

import CategoryList, { CategoryListFC } from "./CategoryList";

interface IProps {
  visible: boolean;
  onHide: () => void;
}

function CategoryDialog({ visible, onHide }: IProps) {
  const { t } = useTranslation("common");

  return (
    <Modal isOpen={visible} size="lg" title={t("Categories")} onClose={() => onHide()}>
      <CategoryListFC />

      <CategoryList />

      <div onClick={() => onHide()}>Close me</div>
    </Modal>
  );
}

export default CategoryDialog;
