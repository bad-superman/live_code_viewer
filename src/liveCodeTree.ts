import * as vscode from 'vscode';

/** 占位节点（无文件列表时显示） */
const PLACEHOLDER_PATH = '__livecode_empty__';

/** 树节点：文件夹或文件，path 为相对路径；或占位节点 */
export type LiveCodeTreeNode =
  | { kind: 'folder'; path: string; name: string }
  | { kind: 'file'; path: string; name: string }
  | { kind: 'placeholder'; path: string; name: string };

/** 带父子引用的缓存节点，用于 getParent 与 reveal */
type CachedNode = LiveCodeTreeNode & { parent?: CachedNode; children?: CachedNode[] };

const SORT_NODES = (a: LiveCodeTreeNode, b: LiveCodeTreeNode) => {
  const folderFirst = (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1);
  if (folderFirst !== 0) return folderFirst;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
};

/**
 * 观众端「直播项目」目录树数据提供者
 * 根据主播下发的相对路径列表构建层级树，支持 getParent 以便 TreeView.reveal 同步当前文件
 */
export class LiveCodeTreeDataProvider implements vscode.TreeDataProvider<LiveCodeTreeNode> {
  private paths: string[] = [];
  private root: CachedNode;
  private nodeByPath = new Map<string, CachedNode>();
  private _onDidChangeTreeData = new vscode.EventEmitter<LiveCodeTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.root = { kind: 'folder', path: '', name: '', children: [] };
  }

  /** 更新路径列表并刷新树（会重建缓存） */
  updatePaths(paths: string[]): void {
    this.paths = paths;
    this.rebuildCache();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** 清空树（断开连接时） */
  clear(): void {
    this.paths = [];
    this.nodeByPath.clear();
    this.root.children = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  /** 根据相对路径取节点，供 reveal 使用；无则返回 undefined */
  getNodeByPath(relativePath: string): LiveCodeTreeNode | undefined {
    if (!relativePath || relativePath === PLACEHOLDER_PATH) return undefined;
    return this.nodeByPath.get(relativePath);
  }

  getChildren(element?: LiveCodeTreeNode): LiveCodeTreeNode[] {
    if (!element) {
      if (!this.paths.length) {
        return [{ kind: 'placeholder', path: PLACEHOLDER_PATH, name: '（请主播用「文件 > 打开文件夹」打开项目）' }];
      }
      return this.root.children ?? [];
    }

    if (element.kind === 'file' || element.kind === 'placeholder') {
      return [];
    }

    const cached = element as CachedNode;
    return cached.children ?? [];
  }

  getParent(element: LiveCodeTreeNode): LiveCodeTreeNode | undefined {
    if (element.kind === 'placeholder' || !element.path) return undefined;
    const cached = this.nodeByPath.get(element.path) as CachedNode | undefined;
    return cached?.parent;
  }

  private rebuildCache(): void {
    this.nodeByPath.clear();
    this.root.children = [];

    if (!this.paths.length) return;

    for (const p of this.paths) {
      const parts = p.split('/');
      let current: CachedNode = this.root;

      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]!;
        const pathSoFar = parts.slice(0, i + 1).join('/');
        let node = this.nodeByPath.get(pathSoFar) as CachedNode | undefined;

        if (!node) {
          const isFolder =
            i < parts.length - 1 ||
            this.paths.some((x) => x !== pathSoFar && x.startsWith(pathSoFar + '/'));
          node = {
            kind: isFolder ? 'folder' : 'file',
            path: pathSoFar,
            name: seg,
            parent: current,
            children: isFolder ? [] : undefined,
          } as CachedNode;
          this.nodeByPath.set(pathSoFar, node);
          if (current.children) current.children.push(node);
        }

        if (node!.kind === 'folder') current = node!;
      }
    }

    const sortAll = (nodes: CachedNode[]): void => {
      nodes.sort(SORT_NODES);
      nodes.forEach((n) => n.children && sortAll(n.children));
    };
    if (this.root.children) sortAll(this.root.children);
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
