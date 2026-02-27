"use strict";
/**
 * Live Code Viewer 通信协议定义
 * Host 和 Viewer 之间通过 WebSocket 传输 JSON 消息
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
var MessageType;
(function (MessageType) {
    /** 全量同步 - 新观众连接时发送完整状态 */
    MessageType["Sync"] = "sync";
    /** 文件切换 - 主播切换到新文件时发送 */
    MessageType["FileChange"] = "fileChange";
    /** 内容变更 - 主播编辑代码时发送全量内容 */
    MessageType["ContentChange"] = "contentChange";
    /** 光标/选区变化 */
    MessageType["SelectionChange"] = "selectionChange";
    /** 观众数量变化通知 */
    MessageType["ViewerCount"] = "viewerCount";
    /** 主播关闭当前文件 / 无打开文件 */
    MessageType["FileClose"] = "fileClose";
    /** 主播工作区目录树（相对路径列表） */
    MessageType["WorkspaceTree"] = "workspaceTree";
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=protocol.js.map