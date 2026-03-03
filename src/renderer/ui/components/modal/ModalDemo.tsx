/**
 * Modal Demo Component
 * Demonstrates the Modal component variants and features
 */

import React, { useRef, useState } from "react";

import { Button } from "../button/Button";
import { Typography } from "../typography/Typography";
import { Modal, ModalPanel, ModalWrapper } from "./Modal";

export const ModalDemo = () => {
  const [basicOpen, setBasicOpen] = useState(false);
  const [sizeSmOpen, setSizeSmOpen] = useState(false);
  const [sizeLgOpen, setSizeLgOpen] = useState(false);
  const [sizeXlOpen, setSizeXlOpen] = useState(false);
  const [noCloseOpen, setNoCloseOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const focusRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Modal
        </Typography>

        <Typography appearance="subdued">
          Dialog component built on Headless UI. Use Modal for the common case,
          or ModalWrapper and ModalPanel separately for custom layouts. Closes
          on overlay click and Escape key.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Basic Modal
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Button buttonType="secondary" onClick={() => setBasicOpen(true)}>
            Open Basic Modal
          </Button>
        </div>

        <Modal
          isOpen={basicOpen}
          title="Basic Modal"
          onClose={() => setBasicOpen(false)}
        >
          <Typography appearance="moderate">
            This is a basic modal with a title and close button. Click the
            overlay or press Escape to close.
          </Typography>

          <div className="mt-4 flex justify-end gap-2">
            <Button buttonType="secondary" onClick={() => setBasicOpen(false)}>
              Cancel
            </Button>

            <Button onClick={() => setBasicOpen(false)}>Confirm</Button>
          </div>
        </Modal>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Sizes
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Button buttonType="secondary" onClick={() => setSizeSmOpen(true)}>
            Small (sm)
          </Button>

          <Button buttonType="secondary" onClick={() => setSizeLgOpen(true)}>
            Large (lg)
          </Button>

          <Button buttonType="secondary" onClick={() => setSizeXlOpen(true)}>
            Extra Large (xl)
          </Button>
        </div>

        <Modal
          isOpen={sizeSmOpen}
          size="sm"
          title="Small Modal"
          onClose={() => setSizeSmOpen(false)}
        >
          <Typography appearance="moderate">
            A small modal for simple confirmations.
          </Typography>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => setSizeSmOpen(false)}>OK</Button>
          </div>
        </Modal>

        <Modal
          isOpen={sizeLgOpen}
          size="lg"
          title="Large Modal"
          onClose={() => setSizeLgOpen(false)}
        >
          <Typography appearance="moderate">
            A large modal for more detailed content. This gives more space for
            forms, lists, or other complex layouts.
          </Typography>

          <div className="mt-4 flex justify-end gap-2">
            <Button buttonType="secondary" onClick={() => setSizeLgOpen(false)}>
              Cancel
            </Button>

            <Button onClick={() => setSizeLgOpen(false)}>Save</Button>
          </div>
        </Modal>

        <Modal
          isOpen={sizeXlOpen}
          size="xl"
          title="Extra Large Modal"
          onClose={() => setSizeXlOpen(false)}
        >
          <Typography appearance="moderate">
            An extra large modal for content-heavy views like detail pages or
            multi-column layouts.
          </Typography>

          <div className="mt-4 flex justify-end gap-2">
            <Button buttonType="secondary" onClick={() => setSizeXlOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          No Close Button
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Modal without the close button. Can still be closed via overlay click
          or Escape.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Button buttonType="secondary" onClick={() => setNoCloseOpen(true)}>
            Open Without Close Button
          </Button>
        </div>

        <Modal
          isOpen={noCloseOpen}
          showCloseButton={false}
          title="No Close Button"
          onClose={() => setNoCloseOpen(false)}
        >
          <Typography appearance="moderate">
            This modal has no close button in the corner. Use the button below
            or click the overlay to dismiss.
          </Typography>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => setNoCloseOpen(false)}>Dismiss</Button>
          </div>
        </Modal>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Initial Focus
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Pass an initialFocusRef to control which element receives focus when
          the modal opens.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Button buttonType="secondary" onClick={() => setFocusOpen(true)}>
            Open With Initial Focus
          </Button>
        </div>

        <Modal
          initialFocusRef={focusRef}
          isOpen={focusOpen}
          title="Initial Focus"
          onClose={() => setFocusOpen(false)}
        >
          <Typography appearance="moderate">
            The &quot;Focused Button&quot; below should receive focus when the
            modal opens.
          </Typography>

          <div className="mt-4 flex justify-end gap-2">
            <Button buttonType="secondary" onClick={() => setFocusOpen(false)}>
              Cancel
            </Button>

            <Button ref={focusRef} onClick={() => setFocusOpen(false)}>
              Focused Button
            </Button>
          </div>
        </Modal>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Custom Layout (ModalWrapper + ModalPanel)
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Use ModalWrapper and ModalPanel separately for custom layouts or
          multiple panels.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Button buttonType="secondary" onClick={() => setCustomOpen(true)}>
            Open Custom Layout
          </Button>
        </div>

        <ModalWrapper
          isOpen={customOpen}
          size="lg"
          onClose={() => setCustomOpen(false)}
        >
          <ModalPanel
            title="Custom Layout"
            onClose={() => setCustomOpen(false)}
          >
            <Typography appearance="moderate">
              This uses ModalWrapper and ModalPanel separately, allowing full
              control over the layout between the overlay and the panel content.
            </Typography>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                buttonType="secondary"
                onClick={() => setCustomOpen(false)}
              >
                Close
              </Button>
            </div>
          </ModalPanel>
        </ModalWrapper>
      </div>
    </div>
  );
};
