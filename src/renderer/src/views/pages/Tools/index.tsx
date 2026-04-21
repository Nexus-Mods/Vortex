import { mdiPin, mdiPlus, mdiFlash, mdiWrench } from "@mdi/js";
import React, { type FC, type PropsWithChildren, type ReactNode } from 'react';
import { useTranslation } from "react-i18next";

import { Button } from '@/ui/components/button/Button';
import { Icon } from '@/ui/components/icon/Icon';
import { Pictogram } from '@/ui/components/pictogram/Pictogram';
import { Typography } from '@/ui/components/typography/Typography';

import EmptyPlaceholder from "../../../controls/EmptyPlaceholder";
import ToolEditDialog from "../../../extensions/starter_dashlet/ToolEditDialog";
import MainPage from "../../MainPage";
import { ToolRow } from "./ToolRow";
import { useToolsPage } from "./useToolsPage";

const Panel = ({ actions, children, heading, iconPath, tooltip }: PropsWithChildren<{ actions?: () => ReactNode; heading:string; iconPath: string; tooltip: string; }>) => (
  <div className="space-y-2">
    <div
      className="flex items-center gap-x-4"
      title={tooltip}
    >
      <Typography appearance="subdued" className="flex grow items-center gap-x-2 font-semibold" typographyType="body-sm">
        <Icon
          className="shrink-0"
          path={iconPath}
          size="sm"
        />

        {heading}
      </Typography>

      {actions?.()}
    </div>

    <div className="space-y-2">
      {children}
    </div>
  </div>
);

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
              text={t("When you are managing a game, supported tools will appear here")}
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
          {/* Header */}
          <div className="mb-4 flex items-start gap-x-2 border-b border-stroke-weak pb-4">
            <Pictogram name="tools" size="sm" />

            <div className="grow">
              <Typography as="h2" typographyType="heading-xs">
                {t("Tools")}
              </Typography>

              <Typography appearance="moderate">
                {t("Tools are external programs or launch options used alongside the game.")}
              </Typography>
            </div>
          </div>

          <div className="space-y-6">
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
                <Panel
                  heading={t("Default launcher")}
                  iconPath={mdiFlash}
                  tooltip={t("Runs instead of the game when you hit Play")}
                >
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
                      {t("Runs instead of the game when you hit Play.")}
                    </Typography>
                  )}
                </Panel>

                {/* Pinned tools section */}
                <Panel
                  heading={t("Pinned tools {{count}}/{{max}}", {count: pinnedCount, max: MAX_PINNED_TOOLS })}
                  iconPath={mdiPin}
                  tooltip={t("Pin shortcuts to your most used tools in the left menu")}
                >
                  {otherPinnedTools.length > 0 ? (
                    otherPinnedTools.map((starter, idx) => (
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
                    ))
                  ) : (
                    <Typography appearance="subdued" typographyType="body-sm">
                      {t("Pin shortcuts to your most used tools in the left menu.")}
                    </Typography>
                  )}
                </Panel>
              </>
            )}

            {/* Tools section */}
            <Panel
              actions={() => (
                <Button
                  buttonType="tertiary"
                  filled="weak"
                  leftIconPath={mdiPlus}
                  size="sm"
                  title={t("Add tool")}
                  onClick={addNewTool}
                />
              )}
              heading={t("Tools")}
              iconPath={mdiWrench}
              tooltip={t("Use the + button to add a new tool")}
            >
              {unpinnedTools.length > 0 ? (
                unpinnedTools.map((starter) => (
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
                ))
              ) : (
                <Typography appearance="subdued" typographyType="body-sm">
                  {t("Use the + button to add a new tool.")}
                </Typography>
              )}
            </Panel>
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
};
