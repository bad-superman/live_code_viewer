import * as vscode from 'vscode';
import { AppManager } from './core/app-manager';
import { RoomPanel } from './ui/room-panel';

let appManager: AppManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  // 初始化应用管理器
  appManager = new AppManager(context);

  // ============ Host 命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.startHosting',
      async () => {
        if (appManager) {
          await appManager.startHosting();
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('live-code-viewer.stopHosting', () => {
      if (appManager) {
        appManager.stopHosting();
      }
    })
  );

  // ============ 复制直播地址命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand('live-code-viewer.copyAddress', () => {
      if (appManager) {
        appManager.copyAddress();
      }
    })
  );

  // ============ Viewer 命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.connect',
      async () => {
        if (appManager) {
          await appManager.connectToHost();
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('live-code-viewer.disconnect', () => {
      if (appManager) {
        appManager.disconnect();
      }
    })
  );

  // ============ 新增命令：多房间管理 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.createRoom',
      async () => {
        if (!appManager) return;

        const name = await vscode.window.showInputBox({
          prompt: '输入房间名称',
          placeHolder: '我的直播房间',
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return '房间名称不能为空';
            }
            return null;
          },
        });

        if (!name) return;

        const roomType = await vscode.window.showQuickPick(
          [
            { label: '公开房间', description: '任何人都可以加入', type: 'public' },
            { label: '私有房间', description: '需要密码', type: 'private' },
            { label: '邀请制房间', description: '仅受邀用户可加入', type: 'invite-only' }
          ],
          {
            placeHolder: '选择房间类型'
          }
        );

        if (!roomType) return;

        let password: string | undefined;
        if (roomType.type === 'private') {
          password = await vscode.window.showInputBox({
            prompt: '设置房间密码',
            password: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return '密码不能为空';
              }
              return null;
            },
          });

          if (!password) return;
        }

        try {
          const roomManager = appManager.getRoomManager();
          const room = roomManager.createRoom({
            name: name.trim(),
            type: roomType.type as any,
            password
          });

          vscode.window.showInformationMessage(
            `Live Code: 房间 "${room.name}" 创建成功`
          );

        } catch (error: any) {
          vscode.window.showErrorMessage(
            `Live Code: 创建房间失败 - ${error.message}`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.listRooms',
      async () => {
        if (!appManager) return;

        const roomManager = appManager.getRoomManager();
        const rooms = roomManager.getAllRooms();

        if (rooms.length === 0) {
          vscode.window.showInformationMessage('Live Code: 暂无房间');
          return;
        }

        const roomItems = rooms.map(room => ({
          label: room.name,
          description: `${room.type} - ${room.participants.length} 人`,
          detail: `创建时间: ${room.createdAt.toLocaleString()}`,
          room
        }));

        const selected = await vscode.window.showQuickPick(roomItems, {
          placeHolder: '选择要进入的房间'
        });

        if (selected) {
          try {
            roomManager.setCurrentRoom(selected.room.id);
            vscode.window.showInformationMessage(
              `Live Code: 已切换到房间 "${selected.room.name}"`
            );
          } catch (error: any) {
            vscode.window.showErrorMessage(
              `Live Code: 切换房间失败 - ${error.message}`
            );
          }
        }
      }
    )
  );

  // ============ 房间面板命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showRoomPanel',
      () => {
        if (!appManager) return;
        
        const roomManager = appManager.getRoomManager();
        RoomPanel.createOrShow(context.extensionUri, roomManager);
      }
    )
  );

  // ============ v0.1.1 新增命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showParticipantPanel',
      () => {
        if (!appManager) return;
        appManager.showParticipantPanel();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showPerformancePanel',
      () => {
        if (!appManager) return;
        appManager.showPerformancePanel();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showErrorReport',
      () => {
        if (!appManager) return;
        appManager.showErrorReport();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showShortcutHelp',
      () => {
        if (!appManager) return;
        appManager.showShortcutHelp();
      }
    )
  );

  // ============ v0.1.2 新增协作编辑命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.enableCollaborativeEditing',
      () => {
        if (!appManager) return;
        appManager.enableCollaborativeEditing();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.disableCollaborativeEditing',
      () => {
        if (!appManager) return;
        appManager.disableCollaborativeEditing();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.showCollaborationPanel',
      () => {
        if (!appManager) return;
        appManager.showCollaborationPanel();
      }
    )
  );

  // ============ 录制命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.startRecording',
      async () => {
        if (!appManager) return;
        await appManager.startRecording();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.stopRecording',
      async () => {
        if (!appManager) return;
        await appManager.stopRecording();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.pauseRecording',
      async () => {
        if (!appManager) return;
        await appManager.pauseRecording();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.resumeRecording',
      async () => {
        if (!appManager) return;
        await appManager.resumeRecording();
      }
    )
  );

  // ============ 播放命令 ============

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.startPlayback',
      async () => {
        if (!appManager) return;
        
        // 获取会话列表
        const sessions = await appManager.getSessionList();
        if (sessions.length === 0) {
          vscode.window.showInformationMessage('没有可播放的录制会话');
          return;
        }

        // 让用户选择会话
        const sessionItems = sessions.map(session => ({
          label: session.title,
          description: `时长: ${Math.round(session.duration / 1000)}秒`,
          detail: `创建时间: ${new Date(session.createdAt).toLocaleString()}`,
          sessionId: session.id
        }));

        const selected = await vscode.window.showQuickPick(sessionItems, {
          placeHolder: '选择要播放的录制会话'
        });

        if (selected) {
          await appManager.startPlayback(selected.sessionId);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.stopPlayback',
      async () => {
        if (!appManager) return;
        await appManager.stopPlayback();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.pausePlayback',
      async () => {
        if (!appManager) return;
        await appManager.pausePlayback();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.resumePlayback',
      async () => {
        if (!appManager) return;
        await appManager.resumePlayback();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'live-code-viewer.listSessions',
      async () => {
        if (!appManager) return;
        
        const sessions = await appManager.getSessionList();
        if (sessions.length === 0) {
          vscode.window.showInformationMessage('暂无录制会话');
          return;
        }

        const sessionItems = sessions.map(session => ({
          label: session.title,
          description: `ID: ${session.id.substring(0, 8)}...`,
          detail: `创建: ${new Date(session.createdAt).toLocaleString()} | 时长: ${Math.round(session.duration / 1000)}秒`
        }));

        const selected = await vscode.window.showQuickPick(sessionItems, {
          placeHolder: '录制会话列表 (选择查看详情)'
        });

        if (selected) {
          vscode.window.showInformationMessage(
            `会话详情: ${selected.label}\n` +
            `ID: ${selected.description}\n` +
            `详细信息: ${selected.detail}`
          );
        }
      }
    )
  );

  console.log('Live Code Viewer v0.1.0 已激活 - 模块化架构');
}

export function deactivate() {
  appManager?.dispose();
  appManager = null;
}