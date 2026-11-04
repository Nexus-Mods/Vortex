import React, { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";
import { DeleteViewModal } from "@/ui/components/view_picker/delete_view_modal/DeleteViewModal";
import { ViewNameModal } from "@/ui/components/view_picker/view_name_modal/ViewNameModal";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";

import { EditedViewStrip } from "../../components/browse_mods/edited_view_strip/EditedViewStrip";
import type { IBrowseModsView } from "../../reducers/mods_views/modsViews";
import { isPreset, type ModPreset, trackedViewOf } from "../../util/mod_views/modViews";
import { useBrowseModsTracker } from "../browse_mods_tracking/BrowseModsTracking.context";
import { type IModSearch } from "../use_mod_search/useModSearch.hook";

/** The bar's panels a view's menu can open: its Filter menu and View options. */
export interface IBrowseModsPanelRefs {
  /** The Filter menu. */
  filters: RefObject<IToolbarPanelHandle | null>;
  /** View options. */
  viewOptions: RefObject<IToolbarPanelHandle | null>;
}

/** Which of the bar's panels to open. */
type BrowseModsPanel = keyof IBrowseModsPanelRefs;

/** Saving what's showing as a new view, from where; or renaming one of the user's own. */
type Naming =
  | { kind: "new"; source: "picker" | "edited_strip" }
  | { kind: "rename"; view: IBrowseModsView };

/**
 * Browse's mods views: the picker with its menus and modals, and the strip saying a preset's been
 * edited. Edit filters and Edit view options open the view, then that panel through `panelRefs`.
 */
export const useBrowseModsViews = (search: IModSearch, panelRefs: IBrowseModsPanelRefs) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const view = search.trackedView;
  const [naming, setNaming] = useState<Naming>();
  const [deleting, setDeleting] = useState<IBrowseModsView>();
  const openOnViewRef = useRef<{ viewId: string; panel: BrowseModsPanel }>(undefined);

  /** Opens a view, counting it unless it's the open one and picking it again changes nothing. */
  const selectView = (id: string) => {
    if (id !== search.viewId || search.changedFilterCount > 0) {
      tracker.trackViewSelected({ view: trackedViewOf(id), previous_view: view });
    }
    search.selectView(id);
  };

  useEffect(() => {
    const pending = openOnViewRef.current;

    if (pending?.viewId === search.viewId) {
      panelRefs[pending.panel].current?.open();
      openOnViewRef.current = undefined;
    }
  }, [panelRefs, search.viewId]);

  /** Opens one of the bar's panels on a view of the user's own, once it's the open view. */
  const editView = (viewId: string, panel: BrowseModsPanel) => {
    if (viewId === search.viewId) {
      panelRefs[panel].current?.open();
      return;
    }

    openOnViewRef.current = { viewId, panel };
    selectView(viewId);
  };

  const presetLabels: Record<ModPreset, string> = {
    trending: t("Trending"),
    popular: t("Most popular"),
    new: t("New releases"),
  };

  const views: IViewPickerView[] = [
    ...Object.entries(presetLabels).map(([id, label]) => ({ id, label })),
    ...search.views.map((custom) => ({
      id: custom.id,
      label: custom.name,
      actions: [
        [
          {
            label: t("Rename view"),
            icon: "edit",
            onClick: () => setNaming({ kind: "rename", view: custom }),
          },
          {
            label: t("Edit filters"),
            icon: "filter_list",
            onClick: () => editView(custom.id, "filters"),
          },
          {
            label: t("Edit view options"),
            icon: "tune",
            onClick: () => editView(custom.id, "viewOptions"),
          },
          { label: t("Delete view"), icon: "delete", onClick: () => setDeleting(custom) },
        ],
      ],
    })),
  ];

  const viewPicker = (
    <>
      <ViewPicker
        className="min-w-0 flex-1"
        label={t("Views")}
        selectedView={search.viewId}
        views={views}
        onAddView={() => setNaming({ kind: "new", source: "picker" })}
        onSelectView={selectView}
      />

      <ViewNameModal
        createDescription={t(
          "Give your view a name. It keeps the sort and filters showing now, and saves any you change after.",
        )}
        isOpen={naming !== undefined}
        placeholder={t("e.g. Most downloaded this month")}
        renameDescription={t("Give your view a new name. Its sort and filters won't change.")}
        renaming={naming?.kind === "rename" ? naming.view.name : undefined}
        onClose={() => setNaming(undefined)}
        onSubmit={(name) => {
          if (naming?.kind === "rename") {
            search.renameView(naming.view.id, name);
            tracker.trackViewRenamed();
          } else if (naming?.kind === "new") {
            tracker.trackViewCreated({ view, source: naming.source });
            search.addView(name);
          }
          setNaming(undefined);
        }}
      />

      <DeleteViewModal
        description={t(
          'Are you sure you want to delete "{{name}}"? This won\'t change any mods, but the view and its sort and filters will be permanently removed.',
          { name: deleting?.name },
        )}
        name={deleting?.name}
        onClose={() => setDeleting(undefined)}
        onDelete={() => {
          if (deleting) {
            search.removeView(deleting.id);
            tracker.trackViewDeleted();
          }
          setDeleting(undefined);
        }}
      />
    </>
  );

  const editedViewStrip = search.isEdited && isPreset(view) && (
    <EditedViewStrip
      viewLabel={presetLabels[view]}
      onReset={() => {
        search.resetView();
        tracker.trackViewReset({ view });
      }}
      onSave={() => setNaming({ kind: "new", source: "edited_strip" })}
    />
  );

  return { viewPicker, editedViewStrip };
};
