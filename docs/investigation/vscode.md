# VS Code extension system

## Overview

- [Development](#development): Microsoft provides [project generators](https://github.com/microsoft/vscode-generator-code), [samples](https://github.com/microsoft/vscode-extension-samples) and [documentation](https://code.visualstudio.com/api) allowing developers to easily develop, test, and publish extensions.
- [Environment](#environment): Separate Node.js process or in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) depending on the [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host).
- [API](#api): Virtual module injected at runtime with declarations provided by a handcrafted and versioned type-only package.
- [UI](#ui): No direct access to the DOM, declarative APIs for native UI or isolated "Webviews" for custom UIs

## Development

The official [documentation](https://code.visualstudio.com/api) covers everything a developer needs:

- an [introduction](https://code.visualstudio.com/api/get-started/your-first-extension) to extension development,
- many [guides](https://code.visualstudio.com/api/extension-guides/overview) with samples for how to use a specific VS Code API,
- [UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) for custom UIs,
- details on how to [test](https://code.visualstudio.com/api/working-with-extensions/testing-extension) and [publish](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) your extension,
- and advanced topics like using [proposed APIs](https://code.visualstudio.com/api/advanced-topics/using-proposed-api).

## Environment

### Host

An [Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host) is responsible for running extensions in VS Code and a different host might be used depending on the extension and the environment:

- **local**: A Node.js extension host running locally, on the same machine as the user interface.
- **web**: A web extension host running in the browser or locally, on the same machine as the user interface.
- **remote**: A Node.js extension host running remotely in a container or a remote location.

Extensions that only target Node.js are only able to run locally or remote, not on the web. [Web Extensions](https://code.visualstudio.com/api/extension-guides/web-extensions) target the browser can run anywhere but work differently as Node.js APIs, node modules and processes are unavailable. Instead, web extensions have to use the VS Code API, bundle any dependency they want to use, and compile native modules like language servers to WASM.

Due to local extensions running on a separate Node.js process, they are **not sandboxed** and have full system access. Web extensions are confined by browser security measurements and the VS Code API.

### Activation

Extensions define up-front in their `package.json` when they should be activated, what commands they provide and more. This allows VS Code to parse the JSON file without needing to load and evaluate the JavaScript code, keeping startup times short and memory usage low. When one of the [activation event](https://code.visualstudio.com/api/references/activation-events) defined by the extension gets triggered, the extension is loaded by the host.

## API

Extensions import the virtual `vscode` module using `require("vscode")` syntax. When an extension gets [activated](#Activation), the [extension host](#Host) injects a custom per-extension instance of the virtual `vscode` module. This allows the extension host to keep track of every API call made by the extension to keep track of subscriptions and anything else the extension is doing. The definition of the virtual `vscode` module is provided by the [`@types/vscode`](https://www.npmjs.com/package/@types/vscode) type-only package. This package contains the [handcrafted defintion](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts) of the VS Code API.

Authors use the `engines.vscode` field in the `package.json` file to declare what API version the extension supports. VS Code parses the version to determine whether the extension is still compatible with the current version of the editor.

### File system

The [API](https://code.visualstudio.com/api/references/vscode-api) provides many useful classes and functions, one important aspect is the [file system API](https://code.visualstudio.com/api/references/vscode-api#FileSystem). VS Code has a unique requirement for file systems: not only can an extension run locally, in the browser, or remote, a user can open one more workspaces in VS Code with files that are local on disk, remote on GitHub or some FTP server. To handle all of these cases, the API has a simple solution based on file system providers and Uris:

Every path is represented as a [`vscode.Uri`](https://code.visualstudio.com/api/references/vscode-api#Uri) and every file system API requires the input to be of type `Uri` instead of `string`. An example:

```typescript
const path = vscode.Uri.joinPath(workspaceFolder.uri, "src", "index.ts");

const bytes: Uint8Array = await vscode.workspace.fs.readFile(path);
const text = new TextDecoder().decode(bytes);
```

This creates a path to `src/index.ts` inside the workspace. On Desktop this might be `file:///home/user/project/src/index.ts` but on [vscode.dev](https://vscode.dev) it's `vscode-vfs://github/org/repo/src/index.ts`. When you want to read the file you simply pass the path to the `readFile` method and get back a `Promise<Uint8Array>`. The genius part of this is using the Uri scheme to denote what file system provider should be used to do the work. The API allows you to easily register new file system providers with custom schemes which allows extensions to run everywhere and interact with anything without caring about the implementation details as long as they follow the API.

The file system API is very small and contained, it only has 9 methods as of 2026-03:

- `copy`
- `createDirectory`
- `delete`
- `isWritableFileSystem`
- `readDirectory`
- `readFile`
- `rename`
- `stat`
- `writeFile`

The simplicity of this API can't be understated. While it obviously doesn't to everything the `node:fs` module provides, its simple, straightforward, fully typed (even the errors), and hard to misuse.

## UI

Extensions are unable to access and modify the VS Code UI directly. Instead, VS Code provides APIs for declarative UIs like commands, menus, key bindings, notifications, status items, tree view items, settings, and more. If an extension author wants to add custom UIs, they can do that using the [Webview API](https://code.visualstudio.com/api/extension-guides/webview). In VS Code, a webview is similar to an `iframe` and it might be implemented as an `iframe` but extensions can't rely on that.

Extensions can create a webview and use it to render custom HTML content and run JavaScript libraries like React. The webview has strict isolation and sandboxing with CSP and communication can only be done via the VS Code API. Since VS Code themes are largely just CSS variables, if the extension uses those CSS variables it will be themed correctly according to the theme selected by the user.

[UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) exist for extension authors to develop UIs that feel native to VS Code.
