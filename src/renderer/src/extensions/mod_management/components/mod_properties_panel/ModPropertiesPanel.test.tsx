import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";

// What the hook works out is set by each test: its own work is the hook's tests'.
vi.mock("../../hooks/use_mod_properties/useModProperties.hook", () => ({
  useModProperties: vi.fn(),
}));

import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { ITableAttribute } from "@/types/ITableAttribute";
import type { TFunction } from "@/util/i18n";

import type {
  IModProperties,
  ModProperty,
} from "../../hooks/use_mod_properties/useModProperties.hook";
import { useModProperties } from "../../hooks/use_mod_properties/useModProperties.hook";
import type { IModWithState } from "../../types/IModProps";
import { RegisteredValues } from "../../util/registered_values/registeredValues";
import { ModPropertiesPanel } from "./ModPropertiesPanel";

const ONE_MOD: IModProperties = {
  count: 1,
  card: {
    name: "SkyUI",
    summary: "A friendlier menu.",
    author: "schlangster",
    isAdult: false,
    status: "downloaded",
  },
  sections: [
    {
      id: "times",
      tab: "general",
      layout: "grid",
      properties: [{ kind: "value", id: "version", label: "Version", value: "5.2" }],
    },
    {
      id: "links",
      tab: "general",
      layout: "list",
      properties: [
        { kind: "value", id: "nexusModId", label: "Nexus Mods ID", value: "12604", copyable: true },
      ],
    },
    {
      id: "files",
      tab: "advanced",
      layout: "list",
      properties: [{ kind: "value", id: "archiveName", label: "Archive name", value: "SkyUI.7z" }],
    },
  ],
};

const CATEGORY: ModProperty = {
  kind: "select",
  id: "category",
  label: "Category",
  value: "1",
  isVarious: false,
  choices: [{ value: "1", label: "Armour" }],
  onChange: vi.fn(),
};

const MODS = [{ id: "a", attributes: { name: "SkyUI" } }] as unknown as IModWithState[];
const MEMBERSHIPS = {};
const REGISTERED = {
  attributes: [],
  detailsOnly: [],
  values: {} as unknown as RegisteredValues,
};

const renderPanel = (properties: IModProperties, onClose = vi.fn(), registered = REGISTERED) => {
  vi.mocked(useModProperties).mockReturnValue(properties);
  return render(
    <Provider store={makeModsTableStore()}>
      <ModPropertiesPanel
        memberships={MEMBERSHIPS}
        mods={MODS}
        registered={registered}
        onClose={onClose}
      />
    </Provider>,
  );
};

const t = ((key: string) => key) as unknown as TFunction;

/**
 * The panel showing a field from data outside the mods an extension says has changed through
 * `externalData`, as the legacy details pane listens to it: drawn by the extension itself, or
 * its `calc` value.
 */
const renderRegistered = (
  drawn: "renderer" | "calc" = "renderer",
  /** Whether the table listens for it, as one of its columns, rather than the panel. */
  isColumn = false,
) => {
  const extension = { label: "No rules", changed: () => {} };
  const externalData = vi.fn((onChanged: () => void) => {
    extension.changed = onChanged;
  });
  const attribute = {
    id: "rules",
    name: "Rules",
    placement: "detail",
    ...(drawn === "renderer"
      ? { isVolatile: true, customRenderer: () => <span>{extension.label}</span> }
      : { calc: () => extension.label }),
    externalData,
  } as unknown as ITableAttribute;
  const registered = {
    attributes: [attribute],
    detailsOnly: isColumn ? [] : [attribute],
    values: new RegisteredValues(t),
  };
  const properties: IModProperties = {
    ...ONE_MOD,
    sections: [
      {
        id: "registered",
        tab: "general",
        layout: "list",
        properties: [
          {
            kind: "registered",
            id: "registered:rules",
            label: "Rules",
            attribute,
            mods: MODS,
            values: registered.values,
          },
        ],
      },
    ],
  };
  const open = () => renderPanel(properties, vi.fn(), registered);
  return { view: open(), open, attribute, extension, externalData, values: registered.values };
};

describe("ModPropertiesPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty state with nothing selected", () => {
    renderPanel({ count: 0, sections: [] });

    expect(screen.getByTestId("mod-properties-empty")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows one mod's card, with its status tag, and General's values", () => {
    renderPanel(ONE_MOD);

    const general = screen.getByRole("tabpanel");
    expect(within(general).getByTestId("mod-properties-card")).toBeInTheDocument();
    expect(within(general).getByTestId("mod-status-downloaded")).toBeInTheDocument();
    expect(within(general).getByTestId("mod-property-version")).toHaveTextContent("5.2");
    expect(within(general).queryByTestId("mod-property-archiveName")).not.toBeInTheDocument();
  });

  it("switches between General and Advanced", async () => {
    renderPanel(ONE_MOD);

    const [general, advanced] = screen.getAllByRole("tab");
    await userEvent.click(advanced);

    expect(advanced).toHaveAttribute("aria-selected", "true");
    expect(general).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("mod-property-archiveName")).toHaveTextContent("SkyUI.7z");
    expect(screen.queryByTestId("mod-properties-card")).not.toBeInTheDocument();
  });

  it("has no Advanced tab with nothing on it", () => {
    renderPanel({ ...ONE_MOD, sections: ONE_MOD.sections.filter(({ tab }) => tab === "general") });

    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("copies a value it offers to", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("api", { ...window.api, clipboard: { writeText } });
    renderPanel(ONE_MOD);

    await userEvent.click(screen.getByTestId("mod-property-copy-nexusModId"));

    expect(writeText).toHaveBeenCalledWith("12604");
  });

  it("shows the fields to change among one mod's values", () => {
    renderPanel({
      ...ONE_MOD,
      sections: [{ id: "organise", tab: "general", layout: "list", properties: [CATEGORY] }],
    });

    // The design system's dropdown: a button named by its label, showing the pick.
    expect(screen.getByRole("button", { name: /^Category/ })).toBeInTheDocument();
  });

  it("counts several mods, with no card, above what they can all change", () => {
    renderPanel({
      count: 3,
      sections: [
        { id: "organise", tab: "general", layout: "list", properties: [CATEGORY] },
        {
          id: "type",
          tab: "advanced",
          layout: "list",
          properties: [{ ...CATEGORY, id: "modType", label: "Mod type" }],
        },
      ],
    });

    expect(screen.getByTestId("mod-properties-count")).toBeInTheDocument();
    expect(screen.queryByTestId("mod-properties-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Category/ })).toBeInTheDocument();
    // Advanced's too, under General's, as there are no tabs to put them on.
    expect(screen.getByRole("button", { name: /^Mod type/ })).toBeInTheDocument();
  });

  it("works out its contents from the mods, memberships and registered details it's given", () => {
    renderPanel(ONE_MOD);

    expect(useModProperties).toHaveBeenCalledWith(MODS, MEMBERSHIPS, REGISTERED);
  });

  // Such as Dependencies, whose rules the dependency manager keeps outside the mods.
  it("draws an extension's field again when the extension says the data it's from changed", () => {
    const { extension } = renderRegistered();
    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("No rules");

    extension.label = "1 rule";
    act(() => extension.changed());

    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("1 rule");
  });

  // Extensions give no way to stop listening, so each call would add a listener for good.
  it("listens to the data its extension fields are from once, however often it opens", () => {
    const { view, open, extension, externalData } = renderRegistered();

    view.unmount();
    // Heard by no one while it's closed.
    act(() => extension.changed());
    open().unmount();
    open();
    extension.label = "1 rule";
    act(() => extension.changed());

    expect(externalData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("1 rule");
  });

  // The data's change is heard by no one while it's closed, so its value is worked out again.
  it("shows a value worked out again for data that changed while it was closed", () => {
    const { view, open, extension } = renderRegistered("calc");
    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("No rules");

    view.unmount();
    extension.label = "1 rule";
    act(() => extension.changed());
    open();

    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("1 rule");
  });

  // Such as a column an extension hides while the panel's closed: the table stops listening.
  it("works out again a field whose value was worked out before it opened", () => {
    const { view, open, attribute, extension, values } = renderRegistered("calc");
    view.unmount();
    // Worked out by the table while it was still a column, then changed with no one listening.
    values.get(attribute, MODS[0], {});
    extension.label = "1 rule";
    open();

    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("1 rule");
  });

  // The table's search re-runs over every mod as the values it subscribes to change.
  it("works its fields out again without telling the table, which doesn't show them", () => {
    const { view, extension, values } = renderRegistered("calc");
    const tableHears = vi.fn();
    values.subscribe(tableHears);

    extension.label = "1 rule";
    act(() => extension.changed());
    expect(screen.getByTestId("mod-property-rules")).toHaveTextContent("1 rule");
    view.unmount();

    expect(tableHears).not.toHaveBeenCalled();
  });

  // Its column's own listener has its values worked out again, as the table shows them too.
  it("leaves a field that's also a column to the table to listen for", () => {
    const { view, externalData, values } = renderRegistered("calc", true);
    const tableHears = vi.fn();
    values.subscribe(tableHears);

    view.unmount();

    expect(externalData).not.toHaveBeenCalled();
    expect(tableHears).not.toHaveBeenCalled();
  });

  it("closes", async () => {
    const onClose = vi.fn();
    renderPanel(ONE_MOD, onClose);

    await userEvent.click(screen.getByTestId("mod-properties-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
