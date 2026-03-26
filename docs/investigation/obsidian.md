# Obsidian plugin system

## Overview

- [Development](#development): Obsidian provides [project templates](https://github.com/obsidianmd/obsidian-sample-plugin) and [documentation](https://docs.obsidian.md/Home) allowing developers to easily develop and publish plugins.
- [Environment](#environment): Directly loaded into the renderer with no sandboxing or isolation and node integration enabled.
- [API](#api): Virtual module injected at runtime with auto-generated type definitions provided by a package. Low quality API otherwise with mixed types from other packages and DOM types.
- [UI](#ui): Direct access to the DOM with some declarative UIs.

## Development

The [documentation](https://docs.obsidian.md/Home) covers

- [introductions](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) to writing plugins,
- [guides](https://docs.obsidian.md/plugins/guides/bases-view) for various scenarios,
- details on [releasing](https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions),
- and a full API reference.

## Environment

Plugins are loaded directly into the renderer process on startup with no sandboxing or isolation. Furthermore, the renderer is spawned with `nodeIntegration: true` and plugins are exported to CJS. This allows plugins to use `require` and import node modules.

Each plugin has an async `onload` and `onunload` method that allows the plugin to do work at the start and end of the life-cycle. Since there is no sandboxing or isolation and plugins have direct access to everything, there is no guarantee that a plugin can be completely unloaded and removed.

## API

Plugins import the virtual `obsidian` module using `require("obsidian")` syntax. How Obsidian injects this module is unclear due to Obsidian being closed source. The only reference we have is the auto-generated type-only [API package](https://github.com/obsidianmd/obsidian-api).

The API includes DOM-specific functions like `registerDOMEvent` and is littered with browser APIs and types. It even contains un-typed external library functions like `loadMermaid(): Promise<any>` even though the API doesn't declare the mermaidjs package as being a peer dependency. The only external dependencies included in the API are `moment`, `@codemirror/state` and `@codemirror/view`. With `@types/codemirror` and `moment` being marked as dependencies and `@codemirror/state` and `@codemirror/view` being marked as peer dependencies.

## UI

The API contains a mix of declarative functionality for commands and other basic components but also has many types that directly expose the DOM. Many APIs provide access to underlying `HTMLElement` instances, allowing plugins to inject anything into the DOM and modify it however they see fit.

Plugins can render anything anywhere but the documentation recommends using [custom views](https://docs.obsidian.md/Plugins/User+interface/Views) for custom UIs written in any [frontend framework](https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin).

Since plugins are loaded directly into the renderer and have full access to the DOM, all custom components will inherit the Obsidian CSS variables which are [documented](https://docs.obsidian.md/Reference/CSS+variables/About+styling) and can be used to style custom components to not look out of place.
