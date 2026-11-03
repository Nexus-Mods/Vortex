import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { SelectField } from "@/ui/components/form/select_field/SelectField";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { ModalPanel, ModalWrapper } from "@/ui/components/modal/Modal";
import { Typography } from "@/ui/components/typography/Typography";

import { finalPath, normalizeDestination } from "../manualInstaller";
import type { IManualInstallerAnswer } from "../manualInstallerQueue";
import type { IManualInstallerRequest } from "../reducers/manualInstaller";

export interface IManualInstallerDialogProps {
  visible: boolean;
  /** the request to answer, the first of the queue */
  request: IManualInstallerRequest | undefined;
  /** Answers the request, undefined when the user cancelled. */
  onAnswer: (requestId: string, answer: IManualInstallerAnswer | undefined) => void;
}

interface IFormProps {
  request: IManualInstallerRequest;
  onAnswer: (answer: IManualInstallerAnswer | undefined) => void;
}

const ManualInstallerForm = ({ request, onAnswer }: IFormProps) => {
  const { t } = useTranslation("mod_management");
  const [created, setCreated] = React.useState<string[]>([]);
  const [folder, setFolder] = React.useState(request.defaultFolder ?? "");
  const [newFolder, setNewFolder] = React.useState("");
  const [skipTopFolder, setSkipTopFolder] = React.useState(false);
  const [useAsDefault, setUseAsDefault] = React.useState(false);
  const [dontAskAgain, setDontAskAgain] = React.useState(false);
  const [useForAll, setUseForAll] = React.useState(false);

  const folders = React.useMemo(
    () => [
      ...new Set([
        "",
        ...(request.defaultFolder !== undefined ? [request.defaultFolder] : []),
        ...created,
      ]),
    ],
    [request.defaultFolder, created],
  );

  const normalizedNewFolder = normalizeDestination(newFolder);
  const newFolderInvalid = newFolder.trim() !== "" && (normalizedNewFolder ?? "") === "";

  const createFolder = () => {
    if (normalizedNewFolder === undefined || normalizedNewFolder === "") {
      return;
    }
    setCreated((prev) => [...prev, normalizedNewFolder]);
    setFolder(normalizedNewFolder);
    setNewFolder("");
  };

  return (
    <ModalPanel
      className="flex max-h-150 flex-col"
      title={t("manualInstaller::title")}
      onClose={() => onAnswer(undefined)}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <Typography appearance="subdued" as="p" typographyType="body-sm">
          {t("manualInstaller::intro", { modName: request.modName })}
        </Typography>

        <SelectField
          data-testid="manual-installer-folder"
          label={t("manualInstaller::folder")}
          value={folder}
          onChange={(evt) => setFolder(evt.target.value)}
        >
          {folders.map((iter) => (
            <option key={iter} value={iter}>
              {iter === "" ? t("manualInstaller::gameFolder") : iter}
            </option>
          ))}
        </SelectField>

        <div className="flex items-end gap-2">
          <TextField
            data-testid="manual-installer-new-folder"
            errorMessage={newFolderInvalid ? t("manualInstaller::invalidFolder") : undefined}
            fieldClassName="grow"
            label={t("manualInstaller::newFolder")}
            value={newFolder}
            onChange={(evt) => setNewFolder(evt.target.value)}
          />

          <Button
            appearance="moderate"
            brand="neutral"
            data-testid="manual-installer-create-folder"
            disabled={normalizedNewFolder === undefined || normalizedNewFolder === ""}
            onClick={createFolder}
          >
            {t("manualInstaller::createFolder")}
          </Button>
        </div>

        {request.topFolder !== undefined && (
          <CheckboxField
            checked={skipTopFolder}
            data-testid="manual-installer-skip-top-folder"
            label={t("manualInstaller::skipTopFolder", {
              folder: request.topFolder,
            })}
            onChange={setSkipTopFolder}
          />
        )}

        {request.previewFiles.length > 0 && (
          <div>
            <Typography appearance="subdued" as="p" typographyType="body-sm">
              {t("manualInstaller::preview")}
            </Typography>

            <Typography
              as="ul"
              className="mt-1"
              data-testid="manual-installer-preview"
              typographyType="body-sm"
            >
              {request.previewFiles.map((file) => (
                <li key={file}>{finalPath(folder, file, skipTopFolder)}</li>
              ))}
            </Typography>
          </div>
        )}

        <CheckboxField
          checked={useAsDefault}
          data-testid="manual-installer-use-as-default"
          label={t("manualInstaller::useAsDefault")}
          onChange={setUseAsDefault}
        />

        <CheckboxField
          checked={dontAskAgain}
          data-testid="manual-installer-dont-ask-again"
          label={t("manualInstaller::dontAskAgain")}
          onChange={setDontAskAgain}
        />

        {request.remaining > 0 && (
          <CheckboxField
            checked={useForAll}
            data-testid="manual-installer-use-for-all"
            label={t("manualInstaller::useForAll", { count: request.remaining })}
            onChange={setUseForAll}
          />
        )}
      </div>

      <div className="mt-4 flex shrink-0 justify-end gap-2">
        <Button
          appearance="subdued"
          brand="neutral"
          data-testid="manual-installer-cancel"
          onClick={() => onAnswer(undefined)}
        >
          {t("manualInstaller::cancel")}
        </Button>

        <Button
          data-testid="manual-installer-install"
          onClick={() =>
            onAnswer({
              folder,
              skipTopFolder,
              // not asking again only works with a default folder to skip to
              useAsDefault: useAsDefault || dontAskAgain,
              dontAskAgain,
              useForAll,
            })
          }
        >
          {t("manualInstaller::install")}
        </Button>
      </div>
    </ModalPanel>
  );
};

export const ManualInstallerDialog = ({
  visible,
  request,
  onAnswer,
}: IManualInstallerDialogProps) =>
  request === undefined ? null : (
    <ModalWrapper isOpen={visible} onClose={() => onAnswer(request.id, undefined)}>
      {/* keyed by request: each one starts with a fresh form */}
      <ManualInstallerForm
        key={request.id}
        request={request}
        onAnswer={(answer) => onAnswer(request.id, answer)}
      />
    </ModalWrapper>
  );
