/**
 * Live Code Viewer 通信协议定义
 * Host 和 Viewer 之间通过 WebSocket 传输 JSON 消息
 */

export enum MessageType {
  /** 全量同步 - 新观众连接时发送完整状态 */
  Sync = 'sync',
  /** 文件切换 - 主播切换到新文件时发送 */
  FileChange = 'fileChange',
  /** 内容变更 - 主播编辑代码时发送全量内容 */
  ContentChange = 'contentChange',
  /** 光标/选区变化 */
  SelectionChange = 'selectionChange',
  /** 观众数量变化通知 */
  ViewerCount = 'viewerCount',
  /** 主播关闭当前文件 / 无打开文件 */
  FileClose = 'fileClose',
  /** 主播工作区目录树（相对路径列表） */
  WorkspaceTree = 'workspaceTree',
}

export interface Position {
  line: number;
  character: number;
}

export interface Selection {
  start: Position;
  end: Position;
}

export interface SyncMessage {
  type: MessageType.Sync;
  fileName: string;
  /** 相对工作区的路径，用于观众端标签页展示 */
  relativePath?: string;
  languageId: string;
  content: string;
  cursor: Position;
  selections: Selection[];
}

export interface FileChangeMessage {
  type: MessageType.FileChange;
  fileName: string;
  /** 相对工作区的路径，用于观众端标签页展示 */
  relativePath?: string;
  languageId: string;
  content: string;
}

export interface FileCloseMessage {
  type: MessageType.FileClose;
}

export interface WorkspaceTreeMessage {
  type: MessageType.WorkspaceTree;
  /** 相对工作区的文件路径列表，如 ["src/a.ts", "README.md"] */
  paths: string[];
}

export interface ContentChangeMessage {
  type: MessageType.ContentChange;
  fullContent: string;
}

export interface SelectionChangeMessage {
  type: MessageType.SelectionChange;
  cursor: Position;
  selections: Selection[];
}

export interface ViewerCountMessage {
  type: MessageType.ViewerCount;
  count: number;
}

export type LiveMessage =
  | SyncMessage
  | FileChangeMessage
  | ContentChangeMessage
  | SelectionChangeMessage
  | ViewerCountMessage
  | FileCloseMessage
  | WorkspaceTreeMessage;
