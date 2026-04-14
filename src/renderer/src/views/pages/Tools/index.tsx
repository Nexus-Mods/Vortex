import { mdiPin, mdiPlus, mdiFlash, mdiWrench } from "@mdi/js";
import React, { type FC } from "react";
import { useTranslation } from "react-i18next";

import EmptyPlaceholder from "../../../controls/EmptyPlaceholder";
import ToolEditDialog from "../../../extensions/starter_dashlet/ToolEditDialog";
import { Button } from "../../../ui/components/button/Button";
import { Icon } from "../../../ui/components/icon/Icon";
import { Typography } from "../../../ui/components/typography/Typography";
import MainPage from "../../MainPage";
import { ToolRow } from "./ToolRow";
import { useToolsPage } from "./useToolsPage";

export const ToolsPage: FC = () => {
  const { t } = useTranslation();
  const {
    gameMode,
    toolBeingEdited,
    counter,
    launcherTool,
    otherPinnedTools,
    unpinnedTools,
    isToolValid,
    isToolRunning,
    pinnedCount,
    maxPinnedReached,
    MAX_PINNED_TOOLS,
    addNewTool,
    editTool,
    removeTool,
    startTool,
    setToolPrimary,
    togglePin,
    moveToolUp,
    moveToolDown,
    closeEditDialog,
  } = useToolsPage();

  if (gameMode === undefined) {
    return (
      <MainPage id="tools-page">
        <MainPage.Body>
          <div className="h-full p-6">
            <EmptyPlaceholder
              fill={true}
              icon="game"
              text={t(
                "When you are managing a game, supported tools will appear here",
              )}
            />
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  return (
    <MainPage id="tools-page">
      <MainPage.Body>
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-x-4">
              <Icon
                className="mt-0.5 shrink-0 text-primary-moderate"
                path={mdiWrench}
                size="lg"
              />

              <div className="grow">
                <Typography as="h2" className="m-0" typographyType="heading-xs">
                  {t("Tools")}
                </Typography>

                <Typography appearance="moderate">
                  {t(
                    "Tools are external programs or launch options used alongside the game.",
                  )}
                </Typography>
              </div>
            </div>

            <hr className="border-stroke-weak" />

            {/* Edit dialog */}
            {toolBeingEdited !== undefined && (
              <ToolEditDialog
                tool={toolBeingEdited}
                onClose={closeEditDialog}
              />
            )}

            {/* Default launcher & pinned tools - only shown when tools exist */}
            {(launcherTool ||
              otherPinnedTools.length > 0 ||
              unpinnedTools.length > 0) && (
              <>
                {/* Default launcher section */}
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-x-2"
                    title={t("Runs instead of the game when you hit Play")}
                  >
                    <Icon
                      className="shrink-0 text-translucent-moderate"
                      path={mdiFlash}
                      size="sm"
                    />

                    <Typography appearance="moderate" typographyType="body-sm">
                      {t("Default launcher")}
                    </Typography>
                  </div>

                  {launcherTool ? (
                    <ToolRow
                      counter={counter}
                      isPinned={true}
                      isPrimary={true}
                      isRunning={isToolRunning(launcherTool)}
                      isValid={isToolValid(launcherTool)}
                      starter={launcherTool}
                      onEdit={editTool}
                      onRemove={removeTool}
                      onRun={startTool}
                      onSetPrimary={setToolPrimary}
                      onTogglePin={togglePin}
                    />
                  ) : (
                    <Typography appearance="subdued" typographyType="body-sm">
                      {t(
                        "Runs instead of the game when you hit Play. Set default launcher with the ⚡ button on the tool.",
                      )}
                    </Typography>
                  )}
                </div>

                {/* Pinned tools section */}
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-x-2"
                    title={t("Pin shortcuts to your most used tools")}
                  >
                    <Icon
                      className="shrink-0 text-translucent-moderate"
                      path={mdiPin}
                      size="sm"
                    />

                    <Typography appearance="moderate" typographyType="body-sm">
                      {t("Pinned tools {{count}}/{{max}}", {
                        count: pinnedCount,
                        max: MAX_PINNED_TOOLS,
                      })}
                    </Typography>
                  </div>

                  {otherPinnedTools.length > 0 ? (
                    <div className="space-y-1">
                      {otherPinnedTools.map((starter, idx) => (
                        <ToolRow
                          counter={counter}
                          isFirst={idx === 0}
                          isLast={idx === otherPinnedTools.length - 1}
                          isPinned={true}
                          isPrimary={false}
                          isRunning={isToolRunning(starter)}
                          isValid={isToolValid(starter)}
                          key={starter.id}
                          showReorder={true}
                          starter={starter}
                          onEdit={editTool}
                          onMoveDown={moveToolDown}
                          onMoveUp={moveToolUp}
                          onRemove={removeTool}
                          onRun={startTool}
                          onSetPrimary={setToolPrimary}
                          onTogglePin={togglePin}
                        />
                      ))}
                    </div>
                  ) : (
                    <Typography appearance="subdued" typographyType="body-sm">
                      {t(
                        "Pin shortcuts to your most used tools using the 📌 button on the tool.",
                      )}
                    </Typography>
                  )}
                </div>
              </>
            )}

            {/* Tools section */}
            <div className="space-y-2">
              <div
                className="flex items-center gap-x-2"
                title={t(
                  "External programs or launch options used alongside the game",
                )}
              >
                <Icon
                  className="shrink-0 text-translucent-moderate"
                  path={mdiWrench}
                  size="sm"
                />

                <Typography
                  appearance="moderate"
                  className="grow"
                  typographyType="body-sm"
                >
                  {t("Tools")}
                </Typography>

                <Button
                  buttonType="tertiary"
                  leftIconPath={mdiPlus}
                  size="xs"
                  title={t("Add tool")}
                  onClick={addNewTool}
                />
              </div>

              {unpinnedTools.length > 0 ? (
                <div className="space-y-1">
                  {unpinnedTools.map((starter) => (
                    <ToolRow
                      counter={counter}
                      isPinned={false}
                      isPrimary={false}
                      isRunning={isToolRunning(starter)}
                      isValid={isToolValid(starter)}
                      key={starter.id}
                      pinDisabled={maxPinnedReached}
                      pinDisabledReason={t(
                        "Max pinned tools reached ({{count}}/{{max}})",
                        { count: pinnedCount, max: MAX_PINNED_TOOLS },
                      )}
                      starter={starter}
                      onEdit={editTool}
                      onRemove={removeTool}
                      onRun={startTool}
                      onSetPrimary={setToolPrimary}
                      onTogglePin={togglePin}
                    />
                  ))}
                </div>
              ) : (
                <Typography appearance="subdued" typographyType="body-sm">
                  {t("Use the + button to add a new tool.")}
                </Typography>
              )}
            </div>
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
};
