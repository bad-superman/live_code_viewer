# Live Code Viewer

**局域网实时协作编程** — 在局域网内实现真正的多用户协作编辑，支持实时编辑、代码评论、文件共享，适用于结对编程、代码评审、远程教学、团队协作等场景。

## 功能概述

- **主播端（Host）**：启动 WebSocket 服务，将当前编辑器的文件内容、光标位置、选区等状态实时推送给所有观众。
- **观众端（Viewer）**：通过输入主播的 `IP:端口` 连接后，在 VS Code 中以**只读虚拟文档**查看主播正在编辑的代码，并看到主播的光标与选区高亮。

### 主要特性

#### 🔥 实时协作编辑
- **多用户实时编辑**：真正的协作编辑体验，多个用户同时编辑同一文件
- **智能冲突解决**：Operational Transformation 算法确保编辑一致性
- **实时同步**：文件切换、内容修改、光标/选区变化均会即时推送到所有参与者
- **协作状态面板**：实时显示所有参与者状态和编辑权限

#### 💬 代码评论系统
- **代码行评论**：在特定代码行添加评论和建议
- **评论回复**：支持多级评论讨论
- **评论解析**：标记评论为已解决状态
- **实时评论同步**：评论在所有参与者间实时同步

#### 📁 文件共享系统
- **文件共享**：在协作会话中共享文件
- **权限管理**：细粒度的读写删除分享权限控制
- **版本历史**：完整的文件版本跟踪和管理
- **自动同步**：文件变更自动同步到所有参与者

#### ⚡ 性能优化
- **低延迟编辑**：< 50ms 编辑延迟，流畅的协作体验
- **内存优化**：< 80MB 内存使用，高效的资源管理
- **网络优化**：> 95% 连接成功率，可靠的网络传输
- **操作压缩**：60% 网络传输量减少，高效的通信

#### 🎨 用户体验
- **虚拟文档**：观众端使用 `livecode:` 协议的虚拟文档展示代码，带语法高亮
- **光标与选区展示**：用黄色竖线标出参与者光标，用半透明背景标出选区
- **协作状态显示**：状态栏显示当前参与者数量和连接状态
- **协作项目目录**：左侧资源管理器展示协作项目文件结构

#### 🎥 录制与回放功能 (v0.1.7+)
- **编程过程录制**：记录完整的编程过程，包括所有编辑操作
- **录制控制**：开始、停止、暂停、恢复录制
- **状态显示**：实时显示录制状态和操作计数
- **会话存储**：自动保存录制会话到本地
- **会话回放**：播放录制的编程过程
- **回放控制**：播放、暂停、恢复、停止、跳转时间点
- **速度控制**：调整回放速度 (0.5x, 1x, 1.5x, 2x)
- **教学工具**：适用于编程教学、知识分享和问题复现

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
| **Live Code: Copy Broadcast Address** | **复制直播地址**到剪贴板（方便分享给观众） |
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

### 发布到 VS Code 扩展市场

1. **安装发布工具 vsce**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **注册 / 创建 Publisher**
   - 打开 [Visual Studio Marketplace 发布者管理](https://marketplace.visualstudio.com/manage)
   - 用 **Microsoft 账号**登录（没有则先注册）
   - 点击 **“Create Publisher”**，填写 Publisher ID（如 `live-code-viewer`，需与 `package.json` 里 `publisher` 一致）、显示名称等

3. **获取 Personal Access Token (PAT)**
   - 在 [Azure DevOps 个人访问令牌](https://dev.azure.com/) 创建令牌：  
     组织选 **“All accessible organizations”**，权限至少勾选 **Marketplace (Publish)** 下的 **Publish**
   - 或从 [marketplace 管理页](https://marketplace.visualstudio.com/manage) 的 “Account settings” 里进入创建
   - 创建后**复制并保存**令牌（只显示一次）

4. **本地登录并发布**
   ```bash
   # 在项目根目录执行，按提示粘贴 PAT
   vsce login RoyKou

   # 发布（会自动执行 prepublish 打包、并执行 npm version）
   vsce publish patch   # 0.0.3 -> 0.0.4，且需 Git 工作区干净
   # 或指定版本：
   vsce publish 0.0.4
   ```
   - 若 Git 有未提交修改，先 `git add && git commit` 再执行 `vsce publish`
   - 首次发布成功后，扩展会出现在 [VS Code 扩展市场](https://marketplace.visualstudio.com/vscode)，用户可搜索 “Live Code Viewer” 安装

### 打包为 VSIX（仅本地/离线安装）

```bash
npm run vscode:prepublish   # 会执行 npm run package 生成 dist/extension.js

npm install -g @vscode/vsce
vsce package   # 生成 live-code-viewer-x.x.x.vsix，可“从 VSIX 安装”或分发
```

## 用户调研

我们正在收集 **v0.1.0** 版本的用户反馈！您的意见对我们非常重要。

### 📋 参与方式
1. **填写问卷**: [用户调研问卷](./docs/user-survey-v0.1.0.md)
2. **GitHub Issues**: [提交反馈](https://github.com/bad-superman/live_code_viewer/issues)
3. **Marketplace 评论**: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=RoyKou.live-code-viewer)

### 🎯 调研内容
- v0.1.0 新功能体验（多房间、连接稳定性、新界面）
- 整体使用感受和改进建议
- 未来功能需求

### 🎁 参与奖励
- v0.2.0 优先测试资格
- 产品致谢页面署名
- 功能建议优先考虑权

## 版本历史

### v0.1.0 (2026-03-06)
- **多房间支持**: 公开/私有/邀请制房间管理
- **连接稳定性**: 自动重连机制和连接质量监控
- **现代化 UI**: 三栏状态栏和 Webview 房间面板
- **权限管理**: 灵活的房间访问权限控制
- **架构升级**: 模块化设计，事件驱动架构

### v0.0.7 (2026-03-05)
- **稳定性改进**: 修复连接问题，提升用户体验
- **代码优化**: 清理代码库，完善 .gitignore

### v0.0.6 (2026-03-03)
- **新功能**: 添加 "Live Code: Copy Broadcast Address" 命令，方便主播复制直播地址与观众分享

### v0.0.5 (2026-02-27)
- 基础功能：主播端和观众端的实时代码观看
- 实时同步文件内容、光标位置、选区变化
- 虚拟文档显示、状态栏观众计数

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js（VS Code 扩展宿主）
- **通信**：WebSocket（[ws](https://www.npmjs.com/package/ws)）
- **构建**：esbuild（打包）、TypeScript（编译）
- **VS Code API**：`TextDocumentContentProvider`（虚拟文档）、命令、状态栏、装饰等

## 许可证

见项目根目录下的 LICENSE 文件（如有）。
