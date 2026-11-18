import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ITableAttribute } from "@/types/ITableAttribute";
import type { TFunction } from "@/util/i18n";

import type { IModWithState } from "../../types/IModProps";
import { RegisteredValues } from "../../util/registered_values/registeredValues";
import { RegisteredModProperty } from "./RegisteredModProperty";

const t = ((key: string) => key) as unknown as TFunction;

const modOf = (id: string, version = "1.0") =>
  ({ id, attributes: { version } }) as unknown as IModWithState;
const MOD = modOf("a");

const renderProperty = (attribute: Partial<ITableAttribute>, mods = [MOD]) =>
  render(
    <RegisteredModProperty
      property={{
        kind: "registered",
        id: `registered:${attribute.id}`,
        label: typeof attribute.name === "string" ? attribute.name : "",
        attribute: { placement: "detail", ...attribute } as ITableAttribute,
        mods,
        values: new RegisteredValues(t),
      }}
    />,
  );

describe("RegisteredModProperty", () => {
  it("shows its value under its name", () => {
    renderProperty({ id: "checksum", name: "Checksum", calc: () => "abc123" });

    const field = screen.getByTestId("mod-property-checksum");
    expect(field).toHaveTextContent("Checksum");
    expect(field).toHaveTextContent("abc123");
  });

  it("isn't shown with no value", () => {
    renderProperty({ id: "checksum", name: "Checksum", calc: () => undefined });

    expect(screen.queryByTestId("mod-property-checksum")).not.toBeInTheDocument();
  });

  it("draws one an extension draws itself", () => {
    renderProperty({
      id: "drawn",
      name: "Drawn",
      customRenderer: () => <span data-testid="drawn-by-extension">Hello</span>,
    });

    expect(screen.getByTestId("drawn-by-extension")).toBeInTheDocument();
  });

  it("tells an extension it's drawing for the details pane, as the legacy pane does", () => {
    renderProperty({
      id: "drawn",
      name: "Drawn",
      customRenderer: (_mod, detail) => (
        <span data-testid="drawn-by-extension">{detail ? "details" : "cell"}</span>
      ),
    });

    expect(screen.getByTestId("drawn-by-extension")).toHaveTextContent("details");
  });

  describe("for several mods", () => {
    const version: Partial<ITableAttribute> = {
      id: "version",
      name: "Version",
      supportsMultiple: true,
      calc: (mod: IModWithState) => mod.attributes?.version,
    };

    it("shows the value they share", () => {
      renderProperty(version, [modOf("a"), modOf("b")]);

      expect(screen.getByTestId("mod-property-version")).toHaveTextContent("1.0");
    });

    it("says Various where they differ", () => {
      renderProperty(version, [modOf("a"), modOf("b", "2.0")]);

      expect(screen.getByTestId("mod-property-version")).toHaveTextContent("Various");
    });

    it("draws one an extension draws itself with them all", () => {
      const customRenderer = vi.fn(() => <span data-testid="drawn-by-extension" />);
      const mods = [modOf("a"), modOf("b")];
      renderProperty({ id: "drawn", name: "Drawn", supportsMultiple: true, customRenderer }, mods);

      expect(customRenderer).toHaveBeenCalledWith(mods, true, expect.anything(), expect.anything());
    });
  });

  describe("with the extension's editor", () => {
    it("picks from its choices, sending the pick to the mod", async () => {
      const onChangeValue = vi.fn();
      renderProperty({
        id: "priority",
        name: "Priority",
        calc: () => "Low",
        edit: {
          choices: () => [
            { key: "low", text: "Low" },
            { key: "high", text: "High" },
          ],
          onChangeValue,
        },
      });

      expect(screen.getByRole("button")).toHaveTextContent("Low");
      await userEvent.click(screen.getByRole("button"));
      await userEvent.click(screen.getAllByRole("option")[2]);

      expect(onChangeValue).toHaveBeenCalledWith(MOD, "high");
    });

    it("saves typed text the extension takes, on leaving the box", async () => {
      const onChangeValue = vi.fn();
      renderProperty({
        id: "tag",
        name: "Tag",
        calc: () => "",
        edit: { validate: (input) => (input === "" ? "error" : "success"), onChangeValue },
      });

      await userEvent.type(screen.getByRole("textbox"), "Mine");
      fireEvent.blur(screen.getByRole("textbox"));

      expect(onChangeValue).toHaveBeenCalledWith(MOD, "Mine");
    });
  });
});
