"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveCodeTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
/** 占位节点（无文件列表时显示） */
const PLACEHOLDER_PATH = '__livecode_empty__';
/**
 * 观众端「直播项目」目录树数据提供者
 * 根据主播下发的相对路径列表构建层级树
 */
class LiveCodeTreeDataProvider {
    constructor() {
        this.paths = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    /** 更新路径列表并刷新树 */
    updatePaths(paths) {
        this.paths = paths;
        this._onDidChangeTreeData.fire(undefined);
    }
    /** 清空树（断开连接时） */
    clear() {
        this.paths = [];
        this._onDidChangeTreeData.fire(undefined);
    }
    getChildren(element) {
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
        const children = new Map();
        for (const p of this.paths) {
            if (!p.startsWith(prefix))
                continue;
            const rest = p.slice(prefix.length);
            const seg = rest.includes('/') ? rest.split('/')[0] : rest;
            const childPath = element.path + '/' + seg;
            if (children.has(seg))
                continue;
            const isFolder = this.paths.some((x) => x !== childPath && x.startsWith(childPath + '/'));
            children.set(seg, {
                kind: isFolder ? 'folder' : 'file',
                path: childPath,
                name: seg,
            });
        }
        return Array.from(children.values()).sort((a, b) => {
            if (a.kind !== b.kind)
                return a.kind === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }
    getRootNodes() {
        const seen = new Map();
        for (const p of this.paths) {
            const seg = p.includes('/') ? p.split('/')[0] : p;
            if (seen.has(seg))
                continue;
            const isFolder = this.paths.some((x) => x !== seg && (x === seg + '/' || x.startsWith(seg + '/')));
            seen.set(seg, {
                kind: isFolder ? 'folder' : 'file',
                path: seg,
                name: seg,
            });
        }
        return Array.from(seen.values()).sort((a, b) => {
            if (a.kind !== b.kind)
                return a.kind === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }
    getTreeItem(element) {
        const isFolder = element.kind === 'folder';
        const item = new vscode.TreeItem(element.name, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        item.contextValue = element.kind;
        item.tooltip = element.kind === 'placeholder' ? element.name : element.path;
        return item;
    }
}
exports.LiveCodeTreeDataProvider = LiveCodeTreeDataProvider;
//# sourceMappingURL=liveCodeTree.js.map