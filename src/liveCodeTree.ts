import * as vscode from 'vscode';

/** 占位节点（无文件列表时显示） */
const PLACEHOLDER_PATH = '__livecode_empty__';

/** 树节点：文件夹或文件，path 为相对路径；或占位节点 */
export type LiveCodeTreeNode =
  | { kind: 'folder'; path: string; name: string }
  | { kind: 'file'; path: string; name: string }
  | { kind: 'placeholder'; path: string; name: string };

/**
 * 观众端「直播项目」目录树数据提供者
 * 根据主播下发的相对路径列表构建层级树
 */
export class LiveCodeTreeDataProvider implements vscode.TreeDataProvider<LiveCodeTreeNode> {
  private paths: string[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<LiveCodeTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /** 更新路径列表并刷新树 */
  updatePaths(paths: string[]): void {
    this.paths = paths;
    this._onDidChangeTreeData.fire(undefined);
  }

  /** 清空树（断开连接时） */
  clear(): void {
    this.paths = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getChildren(element?: LiveCodeTreeNode): LiveCodeTreeNode[] {
    if (!element) {
      if (!this.paths.length) {
        return [{ kind: 'placeholder', path: PLACEHOLDER_PATH, name: '（请主播用「文件 > 打开文件夹」打开项目）' }];
      }
      return this.getRootNodes();
    }

    if (element.kind === 'file' || element.kind === 'placeholder') {
      return [];
    }

    const prefix = element.path + '/';
    const children = new Map<string, LiveCodeTreeNode>();

    for (const p of this.paths) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const seg = rest.includes('/') ? rest.split('/')[0]! : rest;
      const childPath = element.path + '/' + seg;
      if (children.has(seg)) continue;
      const isFolder = this.paths.some((x) => x !== childPath && x.startsWith(childPath + '/'));
      children.set(seg, {
        kind: isFolder ? 'folder' : 'file',
        path: childPath,
        name: seg,
      });
    }

    return Array.from(children.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  private getRootNodes(): LiveCodeTreeNode[] {
    const seen = new Map<string, LiveCodeTreeNode>();

    for (const p of this.paths) {
      const seg = p.includes('/') ? p.split('/')[0]! : p;
      if (seen.has(seg)) continue;
      const isFolder = this.paths.some((x) => x !== seg && (x === seg + '/' || x.startsWith(seg + '/')));
      seen.set(seg, {
        kind: isFolder ? 'folder' : 'file',
        path: seg,
        name: seg,
      });
    }

    return Array.from(seen.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  getTreeItem(element: LiveCodeTreeNode): vscode.TreeItem {
    const isFolder = element.kind === 'folder';
    const item = new vscode.TreeItem(
      element.name,
      isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = element.kind;
    item.tooltip = element.kind === 'placeholder' ? element.name : element.path;
    return item;
  }
}
