import * as vscode from 'vscode';
import { ConnectionStatus } from '../core/connection-manager';
import { Room } from '../core/room-manager';
import { RecordingState } from '../recording/recording-manager';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private connectionStatusBarItem: vscode.StatusBarItem;
  private roomStatusBarItem: vscode.StatusBarItem;
  private recordingStatusBarItem: vscode.StatusBarItem;

  constructor() {
    // 主状态栏项目
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.text = '$(broadcast) Live Code';
    this.statusBarItem.tooltip = 'Live Code Viewer - 点击查看状态';
    this.statusBarItem.command = 'live-code-viewer.listRooms';

    // 连接状态栏项目
    this.connectionStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );

    // 房间状态栏项目
    this.roomStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      98
    );

    // 录制状态栏项目
    this.recordingStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      97
    );

    this.showInitialState();
  }

  /**
   * 显示初始状态
   */
  private showInitialState(): void {
    this.statusBarItem.show();
    this.updateConnectionStatus({
      isConnected: false,
      isConnecting: false,
      connectionQuality: 'disconnected'
    });
    this.updateRoomStatus(null);
  }

  /**
   * 更新连接状态显示
   */
  updateConnectionStatus(status: ConnectionStatus): void {
    let icon = '$(circle-large-outline)';
    let text = '断开连接';
    let color: string | undefined;
    let tooltip = 'Live Code: 断开连接';

    if (status.isConnecting) {
      icon = '$(sync~spin)';
      text = '连接中...';
      tooltip = 'Live Code: 正在连接...';
    } else if (status.isConnected) {
      switch (status.connectionQuality) {
        case 'excellent':
          icon = '$(check)';
          text = '连接优秀';
          color = '#00ff00';
          tooltip = `Live Code: 连接优秀 ${status.latency ? `(${status.latency}ms)` : ''}`;
          break;
        case 'good':
          icon = '$(check)';
          text = '连接良好';
          color = '#ffff00';
          tooltip = `Live Code: 连接良好 ${status.latency ? `(${status.latency}ms)` : ''}`;
          break;
        case 'poor':
          icon = '$(warning)';
          text = '连接较差';
          color = '#ff8800';
          tooltip = `Live Code: 连接较差 ${status.latency ? `(${status.latency}ms)` : ''}`;
          break;
      }
    } else if (status.lastError) {
      icon = '$(error)';
      text = '连接错误';
      color = '#ff0000';
      tooltip = `Live Code: 连接错误 - ${status.lastError}`;
    }

    this.connectionStatusBarItem.text = `${icon} ${text}`;
    this.connectionStatusBarItem.tooltip = tooltip;
    this.connectionStatusBarItem.color = color;
    this.connectionStatusBarItem.show();
  }

  /**
   * 更新房间状态显示
   */
  updateRoomStatus(room: Room | null): void {
    if (!room) {
      this.roomStatusBarItem.text = '$(home) 无房间';
      this.roomStatusBarItem.tooltip = 'Live Code: 当前无活跃房间';
      this.roomStatusBarItem.command = 'live-code-viewer.createRoom';
    } else {
      const participantCount = room.participants.length;
      const roomTypeIcon = this.getRoomTypeIcon(room.type);
      
      this.roomStatusBarItem.text = `${roomTypeIcon} ${room.name} (${participantCount})`;
      this.roomStatusBarItem.tooltip = `Live Code: ${room.name} - ${room.type}房间 - ${participantCount}人`;
      this.roomStatusBarItem.command = 'live-code-viewer.listRooms';
    }
    
    this.roomStatusBarItem.show();
  }

  /**
   * 更新直播状态显示
   */
  updateHostingStatus(isHosting: boolean, viewerCount?: number): void {
    if (isHosting) {
      this.statusBarItem.text = `$(broadcast) 直播中${viewerCount ? ` (${viewerCount})` : ''}`;
      this.statusBarItem.tooltip = `Live Code: 正在直播${viewerCount ? ` - ${viewerCount}人观看` : ''}`;
      this.statusBarItem.color = '#00ff00';
    } else {
      this.statusBarItem.text = '$(broadcast) Live Code';
      this.statusBarItem.tooltip = 'Live Code Viewer - 点击查看状态';
      this.statusBarItem.color = undefined;
    }
  }

  /**
   * 获取房间类型图标
   */
  private getRoomTypeIcon(roomType: string): string {
    switch (roomType) {
      case 'public':
        return '$(globe)';
      case 'private':
        return '$(lock)';
      case 'invite-only':
        return '$(person)';
      default:
        return '$(home)';
    }
  }

  /**
   * 更新录制状态显示
   */
  updateRecordingStatus(state: RecordingState): void {
    if (!state.isRecording) {
      this.recordingStatusBarItem.hide();
      return;
    }

    if (state.isPaused) {
      this.recordingStatusBarItem.text = `$(debug-pause) 录制暂停 (${state.operationCount})`;
      this.recordingStatusBarItem.tooltip = 'Live Code: 录制已暂停 - 点击恢复';
      this.recordingStatusBarItem.color = '#ffff00';
      this.recordingStatusBarItem.command = 'live-code-viewer.resumeRecording';
    } else {
      this.recordingStatusBarItem.text = `$(record) 录制中 (${state.operationCount})`;
      this.recordingStatusBarItem.tooltip = `Live Code: 正在录制 - ${state.operationCount} 个操作 - 点击暂停`;
      this.recordingStatusBarItem.color = '#ff0000';
      this.recordingStatusBarItem.command = 'live-code-viewer.pauseRecording';
    }

    this.recordingStatusBarItem.show();
  }

  /**
   * 显示临时消息
   */
  showTemporaryMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    let icon = '$(info)';
    let color: string | undefined;

    switch (type) {
      case 'warning':
        icon = '$(warning)';
        color = '#ffff00';
        break;
      case 'error':
        icon = '$(error)';
        color = '#ff0000';
        break;
    }

    this.statusBarItem.text = `${icon} ${message}`;
    this.statusBarItem.color = color;

    // 3秒后恢复原状态
    setTimeout(() => {
      this.statusBarItem.text = '$(broadcast) Live Code';
      this.statusBarItem.color = undefined;
    }, 3000);
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.connectionStatusBarItem.dispose();
    this.roomStatusBarItem.dispose();
    this.recordingStatusBarItem.dispose();
  }
}