import * as vscode from 'vscode';
import { RoomManager, Room, RoomType } from '../core/room-manager';

export class RoomPanel {
  public static currentPanel: RoomPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, roomManager: RoomManager) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 如果已经有面板，则显示它
    if (RoomPanel.currentPanel) {
      RoomPanel.currentPanel._panel.reveal(column);
      return;
    }

    // 否则创建新面板
    const panel = vscode.window.createWebviewPanel(
      'liveCodeRooms',
      'Live Code 房间管理',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    RoomPanel.currentPanel = new RoomPanel(panel, extensionUri, roomManager);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private roomManager: RoomManager
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // 设置 Webview 内容
    this._update();

    // 监听面板关闭
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // 监听 Webview 消息
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'createRoom':
            await this.handleCreateRoom(message.name, message.type, message.password);
            break;
          case 'joinRoom':
            await this.handleJoinRoom(message.roomId);
            break;
          case 'closeRoom':
            await this.handleCloseRoom(message.roomId);
            break;
          case 'deleteRoom':
            await this.handleDeleteRoom(message.roomId);
            break;
          case 'refresh':
            this._update();
            break;
        }
      },
      null,
      this._disposables
    );

    // 监听房间变化
    this.roomManager.on('roomCreated', () => this._update());
    this.roomManager.on('roomUpdated', () => this._update());
    this.roomManager.on('roomDeleted', () => this._update());
  }

  private async handleCreateRoom(name: string, type: RoomType, password?: string) {
    try {
      const room = this.roomManager.createRoom({ name, type, password });
      this._panel.webview.postMessage({
        command: 'roomCreated',
        room: room
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        command: 'error',
        message: error.message
      });
    }
  }

  private async handleJoinRoom(roomId: string) {
    try {
      this.roomManager.setCurrentRoom(roomId);
      this._panel.webview.postMessage({
        command: 'roomJoined',
        roomId
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        command: 'error',
        message: error.message
      });
    }
  }

  private async handleCloseRoom(roomId: string) {
    this.roomManager.closeRoom(roomId);
    this._panel.webview.postMessage({
      command: 'roomClosed',
      roomId
    });
  }

  private async handleDeleteRoom(roomId: string) {
    this.roomManager.deleteRoom(roomId);
    this._panel.webview.postMessage({
      command: 'roomDeleted',
      roomId
    });
  }

  private _update() {
    const rooms = this.roomManager.getAllRooms();
    const currentRoom = this.roomManager.getCurrentRoom();

    this._panel.webview.html = this._getHtmlForWebview(rooms, currentRoom);
  }

  private _getHtmlForWebview(rooms: Room[], currentRoom: Room | undefined): string {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Code 房间管理</title>
          <style>
            body {
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
              color: var(--vscode-foreground);
              background-color: var(--vscode-editor-background);
              padding: 20px;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }
            
            .room-list {
              border: 1px solid var(--vscode-panel-border);
              border-radius: 4px;
              overflow: hidden;
            }
            
            .room-item {
              padding: 12px 16px;
              border-bottom: 1px solid var(--vscode-panel-border);
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .room-item:last-child {
              border-bottom: none;
            }
            
            .room-info {
              flex: 1;
            }
            
            .room-name {
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .room-meta {
              font-size: 12px;
              color: var(--vscode-descriptionForeground);
            }
            
            .room-actions {
              display: flex;
              gap: 8px;
            }
            
            .btn {
              padding: 4px 8px;
              border: 1px solid var(--vscode-button-border);
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border-radius: 2px;
              cursor: pointer;
              font-size: 12px;
            }
            
            .btn:hover {
              background: var(--vscode-button-hoverBackground);
            }
            
            .btn-danger {
              background: var(--vscode-inputValidation-errorBackground);
              border-color: var(--vscode-inputValidation-errorBorder);
            }
            
            .current-room {
              background: var(--vscode-list-activeSelectionBackground);
              color: var(--vscode-list-activeSelectionForeground);
            }
            
            .empty-state {
              text-align: center;
              padding: 40px 20px;
              color: var(--vscode-descriptionForeground);
            }
            
            .room-type {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 11px;
              margin-right: 8px;
            }
            
            .room-type-public {
              background: var(--vscode-badge-background);
              color: var(--vscode-badge-foreground);
            }
            
            .room-type-private {
              background: var(--vscode-inputOption-activeBackground);
              color: var(--vscode-inputOption-activeForeground);
            }
            
            .room-type-invite {
              background: var(--vscode-minimap-findMatchHighlight);
              color: var(--vscode-foreground);
            }
          </style>
      </head>
      <body>
          <div class="header">
            <h2>Live Code 房间管理</h2>
            <button class="btn" onclick="createRoom()">创建房间</button>
          </div>
          
          <div class="room-list">
            ${rooms.length === 0 ? 
              '<div class="empty-state">暂无房间<br><button class="btn" onclick="createRoom()">创建第一个房间</button></div>' : 
              rooms.map(room => this._getRoomHtml(room, currentRoom?.id === room.id)).join('')
            }
          </div>
          
          <script>
            const vscode = acquireVsCodeApi();
            
            function createRoom() {
              vscode.postMessage({
                command: 'createRoom',
                name: '新房间',
                type: 'public'
              });
            }
            
            function joinRoom(roomId) {
              vscode.postMessage({
                command: 'joinRoom',
                roomId
              });
            }
            
            function closeRoom(roomId) {
              vscode.postMessage({
                command: 'closeRoom',
                roomId
              });
            }
            
            function deleteRoom(roomId) {
              if (confirm('确定要删除这个房间吗？')) {
                vscode.postMessage({
                  command: 'deleteRoom',
                  roomId
                });
              }
            }
            
            function refresh() {
              vscode.postMessage({
                command: 'refresh'
              });
            }
            
            // 监听来自扩展的消息
            window.addEventListener('message', event => {
              const message = event.data;
              switch (message.command) {
                case 'roomCreated':
                case 'roomJoined':
                case 'roomClosed':
                case 'roomDeleted':
                  refresh();
                  break;
                case 'error':
                  alert(message.message);
                  break;
              }
            });
          </script>
      </body>
      </html>
    `;
  }

  private _getRoomHtml(room: Room, isCurrent: boolean): string {
    const typeClass = `room-type room-type-${room.type}`;
    const typeText = room.type === 'public' ? '公开' : 
                    room.type === 'private' ? '私有' : '邀请制';
    
    return `
      <div class="room-item ${isCurrent ? 'current-room' : ''}">
        <div class="room-info">
          <div class="room-name">${room.name}</div>
          <div class="room-meta">
            <span class="${typeClass}">${typeText}</span>
            创建者: ${room.host} | 
            参与者: ${room.participants.length}人 | 
            创建时间: ${room.createdAt.toLocaleString()}
          </div>
        </div>
        <div class="room-actions">
          ${!isCurrent ? `<button class="btn" onclick="joinRoom('${room.id}')">进入</button>` : ''}
          <button class="btn" onclick="closeRoom('${room.id}')">关闭</button>
          <button class="btn btn-danger" onclick="deleteRoom('${room.id}')">删除</button>
        </div>
      </div>
    `;
  }

  public dispose() {
    RoomPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}