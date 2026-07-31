import React from "react";

import { PremiumModal } from "../premium_modal/PremiumModal";

/**
 * The premium upsell as both mod-requirement surfaces raise it: one required mod, whose free-user
 * fallback is that mod's page on the website. Rendered only while the upsell is up, since mounting
 * the modal is what opens it.
 */
export const RequirementPremiumModal = ({
  modId,
  onClose,
  onOpenModPage,
}: {
  modId: number;
  onClose: () => void;
  onOpenModPage: () => void;
}) => (
  <PremiumModal
    modCount={1}
    modId={modId}
    trigger="single_install"
    onClose={onClose}
    onDownload={() => {
      onClose();
      onOpenModPage();
    }}
  />
);
