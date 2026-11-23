import { describe, expect, it } from "vitest";

import { normaliseSnapshot } from "./normaliseSnapshot";

// The two transports disagree on casing. These fixtures are the same install as each
// transport would actually put it on the wire, so a change to either declaration that
// drifts from the wire fails here rather than silently producing undefined fields.

const nativeWire = {
  steps: [
    {
      id: 0,
      name: "Step1",
      visible: true,
      groups: [
        {
          name: "PatchForModB",
          type: "SelectAny",
          options: [
            {
              name: "Patch for Mod B",
              type: "NotUsable",
              selected: false,
              flags: [],
              resolver: {
                kind: "Conditional",
                defaultType: "NotUsable",
                patterns: [
                  {
                    type: "Required",
                    condition: { kind: "Plugin", pluginPath: "b.esp", pluginState: "Active" },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  flags: [],
};

const ipcWire = {
  Steps: [
    {
      Id: 0,
      Name: "Step1",
      Visible: true,
      Groups: [
        {
          Name: "PatchForModB",
          Type: "SelectAny",
          Options: [
            {
              Name: "Patch for Mod B",
              Type: "NotUsable",
              Selected: false,
              Flags: [],
              Resolver: {
                Kind: "Conditional",
                DefaultType: "NotUsable",
                Patterns: [
                  {
                    Type: "Required",
                    Condition: { Kind: "Plugin", PluginPath: "b.esp", PluginState: "Active" },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  Flags: [],
};

describe("normaliseSnapshot", () => {
  it("reads the native camelCase payload", () => {
    const snapshot = normaliseSnapshot(nativeWire);
    expect(snapshot).toBeDefined();
    const option = snapshot!.steps[0].groups[0].options[0];
    expect(option.name).toBe("Patch for Mod B");
    expect(option.type).toBe("NotUsable");
    expect(option.resolver.patterns![0].condition.pluginPath).toBe("b.esp");
  });

  it("reads the IPC PascalCase payload", () => {
    // Newtonsoft with no naming policy, so every field keeps its .NET name.
    const snapshot = normaliseSnapshot(ipcWire);
    expect(snapshot).toBeDefined();
    const option = snapshot!.steps[0].groups[0].options[0];
    expect(option.name).toBe("Patch for Mod B");
    expect(option.type).toBe("NotUsable");
    expect(option.resolver.patterns![0].condition.pluginPath).toBe("b.esp");
  });

  it("produces the same internal form from either transport", () => {
    expect(normaliseSnapshot(nativeWire)).toEqual(normaliseSnapshot(ipcWire));
  });

  it("returns undefined for an install with no snapshot", () => {
    // An installer that predates the snapshot omits it entirely.
    expect(normaliseSnapshot(undefined)).toBeUndefined();
    expect(normaliseSnapshot(null)).toBeUndefined();
    expect(normaliseSnapshot({})).toBeUndefined();
  });

  it("returns undefined rather than an empty snapshot", () => {
    // Callers treat absence as "no snapshot", never as "no options".
    expect(normaliseSnapshot({ steps: [] })).toBeUndefined();
  });

  it("keeps an unrecognised option type undefined instead of coercing it", () => {
    const snapshot = normaliseSnapshot({
      steps: [
        {
          id: 0,
          name: "s",
          visible: true,
          groups: [
            {
              name: "g",
              type: "t",
              options: [
                {
                  name: "o",
                  type: "Bogus",
                  selected: false,
                  resolver: { kind: "Static", type: "Optional" },
                  flags: [],
                },
              ],
            },
          ],
        },
      ],
      flags: [],
    });
    expect(snapshot!.steps[0].groups[0].options[0].type).toBeUndefined();
  });

  it("carries the environment fields through", () => {
    const snapshot = normaliseSnapshot({
      Steps: [
        {
          Id: 0,
          Name: "s",
          Visible: true,
          Groups: [
            {
              Name: "g",
              Type: "t",
              Options: [
                {
                  Name: "o",
                  Type: "NotUsable",
                  Selected: false,
                  Flags: [],
                  Resolver: {
                    Kind: "Conditional",
                    DefaultType: "NotUsable",
                    Patterns: [
                      {
                        Type: "Required",
                        Condition: {
                          Kind: "Environment",
                          EnvironmentType: "GameVersion",
                          MinimumVersion: "99.0.0",
                          Message: "requires a newer game",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      Flags: [],
    });
    const condition = snapshot!.steps[0].groups[0].options[0].resolver.patterns![0].condition;
    expect(condition.kind).toBe("Environment");
    expect(condition.environmentType).toBe("GameVersion");
    expect(condition.minimumVersion).toBe("99.0.0");
    expect(condition.message).toBe("requires a newer game");
  });

  it("keeps a composite's operator and all its leaves", () => {
    const snapshot = normaliseSnapshot({
      Steps: [
        {
          Id: 0,
          Name: "s",
          Visible: true,
          Groups: [
            {
              Name: "g",
              Type: "t",
              Options: [
                {
                  Name: "o",
                  Type: "NotUsable",
                  Selected: false,
                  Flags: [],
                  Resolver: {
                    Kind: "Conditional",
                    DefaultType: "NotUsable",
                    Patterns: [
                      {
                        Type: "Required",
                        Condition: {
                          Kind: "Composite",
                          Operator: "Or",
                          Conditions: [
                            { Kind: "Plugin", PluginPath: "b.esp", PluginState: "Active" },
                            { Kind: "Plugin", PluginPath: "b.esl", PluginState: "Active" },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      Flags: [],
    });
    const condition = snapshot!.steps[0].groups[0].options[0].resolver.patterns![0].condition;
    expect(condition.operator).toBe("Or");
    expect(condition.conditions).toHaveLength(2);
    expect(condition.conditions![1].pluginPath).toBe("b.esl");
  });

  it("reads the flags an option sets", () => {
    const snapshot = normaliseSnapshot({
      steps: [
        {
          id: 0,
          name: "s",
          visible: true,
          groups: [
            {
              name: "g",
              type: "t",
              options: [
                {
                  name: "o",
                  type: "Optional",
                  selected: true,
                  resolver: { kind: "Static", type: "Optional" },
                  flags: [{ name: "patches", value: "enabled" }],
                },
              ],
            },
          ],
        },
      ],
      flags: [{ name: "patches", value: "enabled" }],
    });
    expect(snapshot!.steps[0].groups[0].options[0].flags).toEqual([
      { name: "patches", value: "enabled" },
    ]);
    expect(snapshot!.flags).toEqual([{ name: "patches", value: "enabled" }]);
  });
});
