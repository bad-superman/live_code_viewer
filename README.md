# Live Code Viewer

**局域网实时观看编程** — 在局域网内实时观看队友的代码编辑，适用于结对编程、代码评审、远程教学等场景。

## 功能概述

- **主播端（Host）**：启动 WebSocket 服务，将当前编辑器的文件内容、光标位置、选区等状态实时推送给所有观众。
- **观众端（Viewer）**：通过输入主播的 `IP:端口` 连接后，在 VS Code 中以**只读虚拟文档**查看主播正在编辑的代码，并看到主播的光标与选区高亮。

### 主要特性

- 实时同步：文件切换、内容修改、光标/选区变化均会即时推送到观众端。
- 虚拟文档：观众端使用 `livecode:` 协议的虚拟文档展示代码，天然只读，带语法高亮。
- 光标与选区展示：观众端用黄色竖线标出主播光标，用半透明黄色背景标出主播选区。
- 观众数显示：主播端状态栏显示当前观众数量。
- 直播项目目录树：观众端在左侧**资源管理器（Explorer）**底部有「直播项目」树，展示主播工作区文件结构（主播需用**文件 > 打开文件夹**打开项目，否则列表为空）。

## 目录结构

```
live-code-viewer/
├── src/
│   ├── extension.ts      # 扩展入口：注册命令、虚拟文档提供者
│   ├── host.ts           # 主播端：WebSocket 服务、编辑器事件监听与广播
│   ├── viewer.ts         # 观众端：连接主播、虚拟文档展示与光标/选区装饰
│   ├── virtualDocument.ts # 虚拟文档内容提供者（livecode: scheme）
│   └── protocol.ts       # 通信协议：消息类型与数据结构定义
├── dist/                 # 构建产物（esbuild），供扩展加载
├── out/                  # TypeScript 编译输出（可选，用于调试）
├── .vscode/
│   ├── launch.json       # 调试配置
│   └── .vscodeignore     # 打包时忽略的文件
├── package.json
├── tsconfig.json
└── README.md
```

## 命令与配置

### 命令（Command Palette）

| 命令 | 说明 |
|------|------|
| **Live Code: Start Hosting** | 开始直播（启动 WebSocket 服务） |
| **Live Code: Stop Hosting** | 停止直播 |
| **Live Code: Connect to Host** | 连接到主播（输入 `IP:端口`，如 `192.168.1.100:3456`） |
| **Live Code: Disconnect** | 断开与主播的连接 |

### 配置项

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `liveCodeViewer.port` | number | 3456 | WebSocket 服务端口号 |

## 通信协议（protocol）

Host 与 Viewer 通过 WebSocket 传输 JSON 消息，主要类型：

- **Sync**：全量同步（新观众连接时发送当前文件、内容、光标、选区）。
- **FileChange**：主播切换文件时发送新文件名、语言 ID、内容。
- **ContentChange**：主播编辑时发送当前文档全量内容。
- **SelectionChange**：光标或选区变化。
- **ViewerCount**：观众数量变化（用于主播状态栏展示）。

详见 `src/protocol.ts`。

## 开发与调试

### 环境要求

- Node.js
- VS Code 1.74.0+

### 安装依赖

```bash
npm install
```

### 编译

- 使用 **esbuild** 打包（用于发布与运行扩展）：
  ```bash
  npm run package
  ```
  输出到 `dist/extension.js`。

- 使用 **TypeScript** 编译（可选，用于类型检查/调试）：
  ```bash
  npm run compile
  ```
  输出到 `out/`。

### 调试

1. 在 VS Code 中打开本项目。
2. 按 F5 或选择 “Run > Start Debugging”，会先执行 `npm run compile`，再启动扩展开发主机。
3. 在新窗口中可测试 “Live Code: Start Hosting” 与 “Live Code: Connect to Host”。

### 打包为 VSIX

```bash
# 生成 .vsix 扩展包的步骤：

npm run vscode:prepublish   # （可选）会自动执行 npm run package，打包生成 dist/extension.js

# 安装打包工具 vsce（如果未安装过）:
npm install -g @vscode/vsce

# 使用 vsce 生成 .vsix 文件：
vsce package
```

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js（VS Code 扩展宿主）
- **通信**：WebSocket（[ws](https://www.npmjs.com/package/ws)）
- **构建**：esbuild（打包）、TypeScript（编译）
- **VS Code API**：`TextDocumentContentProvider`（虚拟文档）、命令、状态栏、装饰等

## 许可证

见项目根目录下的 LICENSE 文件（如有）。
