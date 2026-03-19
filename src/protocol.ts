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
  /** 终端已打开 */
  TerminalOpen = 'terminalOpen',
  /** 终端已关闭 */
  TerminalClose = 'terminalClose',
  /** 终端命令开始执行 */
  TerminalCommand = 'terminalCommand',
  /** 终端输出数据（增量） */
  TerminalOutput = 'terminalOutput',
  /** 终端命令执行结束 */
  TerminalCommandEnd = 'terminalCommandEnd',
  /** 终端输入 - 观众向终端输入命令 */
  TerminalInput = 'terminalInput',
  /** 终端输入确认 */
  TerminalInputAck = 'terminalInputAck',
  /** 终端输入状态 */
  TerminalInputStatus = 'terminalInputStatus',
  /** 参与者光标位置同步 */
  CursorSync = 'cursorSync',
  /** 参与者状态更新 */
  ParticipantStatus = 'participantStatus',
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

export interface TerminalOpenMessage {
  type: MessageType.TerminalOpen;
  terminalId: number;
  name: string;
}

export interface TerminalCloseMessage {
  type: MessageType.TerminalClose;
  terminalId: number;
}

export interface TerminalCommandMessage {
  type: MessageType.TerminalCommand;
  terminalId: number;
  command: string;
}

export interface TerminalOutputMessage {
  type: MessageType.TerminalOutput;
  terminalId: number;
  data: string;
}

export interface TerminalCommandEndMessage {
  type: MessageType.TerminalCommandEnd;
  terminalId: number;
  exitCode?: number;
}

/** 终端输入消息 - 观众向终端输入命令 */
export interface TerminalInputMessage {
  type: MessageType.TerminalInput;
  terminalId: number;           // 终端会话ID
  input: string;                // 输入的命令内容
  timestamp: number;            // 时间戳
  userId?: string;              // 用户ID（用于权限管理）
  sessionId?: string;           // 输入会话ID（用于跟踪）
}

/** 终端输入确认消息 */
export interface TerminalInputAckMessage {
  type: MessageType.TerminalInputAck;
  terminalId: number;           // 终端会话ID
  inputId: string;              // 输入消息ID
  status: 'accepted' | 'rejected' | 'pending';  // 输入状态
  reason?: string;              // 拒绝原因
  timestamp: number;            // 时间戳
}

/** 终端输入状态消息 */
export interface TerminalInputStatusMessage {
  type: MessageType.TerminalInputStatus;
  terminalId: number;           // 终端会话ID
  currentInput?: string;        // 当前输入内容
  inputUserId?: string;         // 当前输入用户ID
  status: 'idle' | 'typing' | 'submitted';  // 输入状态
  timestamp: number;            // 时间戳
}

export interface CursorSyncMessage {
  type: MessageType.CursorSync;
  participantId: string;
  participantName: string;
  fileName: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface ParticipantStatusMessage {
  type: MessageType.ParticipantStatus;
  participantId: string;
  participantName: string;
  isActive: boolean;
  lastActivity: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export type LiveMessage =
  | SyncMessage
  | FileChangeMessage
  | ContentChangeMessage
  | SelectionChangeMessage
  | ViewerCountMessage
  | FileCloseMessage
  | WorkspaceTreeMessage
  | TerminalOpenMessage
  | TerminalCloseMessage
  | TerminalCommandMessage
  | TerminalOutputMessage
  | TerminalCommandEndMessage
  | TerminalInputMessage
  | TerminalInputAckMessage
  | TerminalInputStatusMessage
  | CursorSyncMessage
  | ParticipantStatusMessage;
