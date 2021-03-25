import { paste } from 'copy-paste';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import { parse, StackFrame } from 'stack-trace';
import * as vscode from 'vscode';
import SourceMap from './SourceMap';
import { Position, NullableMappedPosition } from 'source-map';

let sourcemap: SourceMap;

let version: string = '0.17.6';

export class StackItem extends vscode.TreeItem {
	private mFrame: NullableMappedPosition;
	private mIsExtension: boolean;
	constructor(frame: StackFrame, onChanged: () => void) {
		super('', vscode.TreeItemCollapsibleState.None);

		this.mFrame = {
			column: frame.getColumnNumber(),
			line: frame.getLineNumber(),
			name: frame.getFunctionName(),
			source: this.sanitizeRel(frame.getFileName()),
		};

		this.tooltip = `${this.mFrame.name} (${this.mFrame.source}:${this.mFrame.line})`;
		this.command = {
			command: 'stackmap.open',
			title: '',
			arguments: [this.mFrame.source, this.mFrame.line, this.mFrame.column],
		};

		this.mIsExtension = (this.mFrame.source || '').indexOf('bundledPlugins') !== -1;

		this.updateLabel();

		if (sourcemap !== undefined) {
			sourcemap.lookup(this.mFrame)
				.then(resolved => {
					this.mFrame = resolved;
					this.mFrame.source = this.sanitizeSrc(this.mFrame.source);
					this.updateLabel();
					onChanged();
				}, err => {
					vscode.window.showErrorMessage(`Failed to resolve "${this.mFrame}": ${err}`);
				});
		}
	}

	private updateLabel() {
		this.label = `${this.mFrame.name} (${this.mFrame.source}:${this.mFrame.line})`;
	}

	private sanitizeRel(input: string | null): string {
		let res = (input || '')
			.replace(/(.*\\webpack:\\)|(.*\\app.asar\\)|(.*\\app.asar.unpacked\\)/,
					 `sourcemaps\\${version}\\`);
		return res;
	}

	private sanitizeSrc(input: string | null): string {
		let res = (input || '').replace(/^webpack:\/*/, '');
		if (this.mIsExtension) {
			res = path.join('extensions', res);
		} else { 
			res = res.replace(/.*\/src\//, 'src/');
		}
		return res;
	}

	contextValue = 'stackitem';
}


export class StackProvider implements vscode.TreeDataProvider<StackItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<StackItem | undefined> = new vscode.EventEmitter<StackItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<StackItem | undefined> = this._onDidChangeTreeData.event;
	private mCurrentStack: StackItem[] = [];

	constructor() {
	}

	setStack(stack: string): void {
		let refreshDebounce: NodeJS.Timeout;
		this.mCurrentStack = parse({ name: '', stack, message: '' })
			.map(frame => new StackItem(frame, () => {
				if (refreshDebounce !== undefined) {
					clearTimeout(refreshDebounce);
				}
				refreshDebounce = setTimeout(() => {
					this.refresh();
					vscode.window.showInformationMessage(`Resolved with ${version} sourcemap`);
				}, 100);
			}));
		this.refresh();
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: StackItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: StackItem): Thenable<StackItem[]> {
		return Promise.resolve(this.mCurrentStack);
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const provider = new StackProvider();
	vscode.window.registerTreeDataProvider('stackmap', provider);

	let workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = undefined;

	let updateWSFolders = () => {
		workspaceFolders = vscode.workspace.workspaceFolders;

		if (workspaceFolders !== undefined) {
			const workspacePath = workspaceFolders[0].uri.fsPath;

			const sourcemapsPath = path.join(workspacePath, 'sourcemaps');
			fs.readdir(sourcemapsPath, (err, files) => {
				version = files.sort((lhs, rhs) => semver.compare(rhs, lhs))[0];
				sourcemap = new SourceMap(workspacePath);
			});
		}
	}

	updateWSFolders();

	vscode.workspace.onDidChangeWorkspaceFolders(evt => {
		updateWSFolders();
	});

	{
		const disposable = vscode.commands.registerCommand('stackmap.open', (fileName: string, line: number, col: number) => {
			const { workspaceFolders, openTextDocument } = vscode.workspace;
			if (workspaceFolders === undefined) {
				return;
			}
			const fullPath = path.join(workspaceFolders[0].uri.fsPath, fileName);
			openTextDocument(fullPath).then(doc => {
				vscode.window.showTextDocument(doc, 1, false).then(editor => {
					editor.revealRange(new vscode.Range(line - 10, 0, line + 10, 0));
					const pos = new vscode.Position(line - 1, col);
					editor.selection = new vscode.Selection(pos, pos);
				}, err => {
					vscode.window.showErrorMessage(`Failed to show document "${fullPath}": ${err.message}`);
				})
			}, err => {
				vscode.window.showErrorMessage(`failed to open "${fullPath}": ${err.message}`);
			});
		});

		context.subscriptions.push(disposable);
	}

	{
		const disposable = vscode.commands.registerCommand('stackmap.selectVersion', () => {
			if (workspaceFolders === undefined) {
				return;
			}

			const workspacePath = workspaceFolders[0].uri.fsPath;
			const sourcemapsPath = path.join(workspacePath, 'sourcemaps');
			fs.readdir(sourcemapsPath, (err, files) => {
				if (err !== null) {
					vscode.window.showErrorMessage(`Failed to read "${sourcemapsPath}": ${err.message}`);
					return;
				}
				let items: vscode.QuickPickItem[] = files.map(filePath => ({
					label: filePath,
				}));

				vscode.window.showQuickPick(items).then(selection => {
					if (!selection) {
						return;
					}

					version = selection.label;
					sourcemap = new SourceMap(workspacePath);
				});
			});
		});

		context.subscriptions.push(disposable);
	}

	{
		const disposable = vscode.commands.registerCommand('stackmap.fromClipboard', () => {
			paste((err, text) => {
				provider.setStack(text);
			});
		});

		context.subscriptions.push(disposable);
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
