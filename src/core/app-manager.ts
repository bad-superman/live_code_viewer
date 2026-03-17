import * as vscode from 'vscode';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { PermissionManager } from './permission-manager';
import { StatusBarManager } from '../ui/status-bar';
import { UsageTracker } from '../utils/usage-tracker';
import { Host } from '../host';
import { Viewer } from '../viewer';
import { LiveCodeDocumentProvider } from '../virtualDocument';
import { LiveCodeTreeDataProvider, LiveCodeTreeNode } from '../liveCodeTree';
import { CursorSyncManager } from '../collaboration/cursor-sync-manager';
import { ParticipantStatusManager } from '../collaboration/participant-status-manager';
import { CollaborationManager } from '../collaboration/collaboration-manager';
import { ShortcutManager } from '../ui/shortcut-manager';
import { ThemeAdapter } from '../ui/theme-adapter';
import { PerformancePanel } from '../ui/performance-panel';
import { ErrorHandler } from './error-handler';
import { RecordingManager, RecordingSession } from '../recording/recording-manager';
import { SessionStorage } from '../recording/session-storage';
import { PlaybackManager } from '../recording/playback-manager';
import { PerformanceMonitor } from '../performance/performance-monitor';

export class AppManager {
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private permissionManager: PermissionManager;
  
  // 协作模块
  private cursorSyncManager: CursorSyncManager;
  private participantStatusManager: ParticipantStatusManager;
  private collaborationManager: CollaborationManager;
  
  // 录制模块
  private recordingManager: RecordingManager;
  private sessionStorage: SessionStorage;
  private playbackManager: PlaybackManager;
  
  // 性能监控
  private performanceMonitor: PerformanceMonitor;
  
  // 用户体验模块
  private shortcutManager: ShortcutManager;
  private themeAdapter: ThemeAdapter;
  private performancePanel: PerformancePanel;
  private errorHandler: ErrorHandler;
  
  private host: Host | null = null;
  private viewer: Viewer | null = null;
  
  private documentProvider: LiveCodeDocumentProvider;
  private treeProvider: LiveCodeTreeDataProvider;
  private treeView: vscode.TreeView<LiveCodeTreeNode>;
  private statusBarManager: StatusBarManager;
  private usageTracker: UsageTracker;

  constructor(private context: vscode.ExtensionContext) {
    // 初始化核心管理器
    this.connectionManager = new ConnectionManager(context);
    this.roomManager = new RoomManager(context);
    this.permissionManager = new PermissionManager();
    
    // 初始化协作模块
    this.cursorSyncManager = new CursorSyncManager(context);
    this.participantStatusManager = new ParticipantStatusManager(context);
    this.collaborationManager = CollaborationManager.getInstance();
    
    // 初始化录制模块
    this.recordingManager = new RecordingManager();
    this.sessionStorage = new SessionStorage();
    this.playbackManager = new PlaybackManager();
    
    // 初始化性能监控
    this.performanceMonitor = new PerformanceMonitor();
    
    // 初始化用户体验模块
    this.shortcutManager = new ShortcutManager(context);
    this.themeAdapter = new ThemeAdapter(context);
    this.performancePanel = new PerformancePanel(context);
    this.errorHandler = new ErrorHandler(context);
    
    // 初始化现有组件
    this.documentProvider = new LiveCodeDocumentProvider();
    this.treeProvider = new LiveCodeTreeDataProvider();
    
    // 注册文档提供者
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        'livecode',
        this.documentProvider
      )
    );

    // 创建树视图
    this.treeView = vscode.window.createTreeView('liveCodeViewer', {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(this.treeView);

    // 初始化状态栏管理器
    this.statusBarManager = new StatusBarManager();
    context.subscriptions.push(this.statusBarManager);

    // 初始化使用跟踪器
    this.usageTracker = new UsageTracker(context);
    context.subscriptions.push(this.usageTracker);

    // 设置状态监听
    this.setupStatusListeners();
  }

  /**
   * 设置状态监听器
   */
  private setupStatusListeners(): void {
    // 监听连接状态变化
    this.connectionManager.onStatusChange((status) => {
      this.statusBarManager.updateConnectionStatus(status);
    });

    // 监听房间状态变化
    this.roomManager.on('roomCreated', (room) => {
      console.log(`房间创建: ${room.name}`);
      this.statusBarManager.updateRoomStatus(room);
      this.statusBarManager.showTemporaryMessage(`房间 "${room.name}" 创建成功`);
    });

    this.roomManager.on('roomUpdated', (room) => {
      console.log(`房间更新: ${room.name}`);
      this.statusBarManager.updateRoomStatus(room);
    });

    this.roomManager.on('roomDeleted', (roomId) => {
      const currentRoom = this.roomManager.getCurrentRoom();
      this.statusBarManager.updateRoomStatus(currentRoom || null);
      this.statusBarManager.showTemporaryMessage('房间已删除', 'info');
    });

    this.roomManager.on('participantJoined', (roomId, participant) => {
      console.log(`参与者加入: ${participant.name}`);
      const currentRoom = this.roomManager.getCurrentRoom();
      if (currentRoom && currentRoom.id === roomId) {
        this.statusBarManager.showTemporaryMessage(`${participant.name} 加入房间`);
      }
    });

    this.roomManager.on('participantLeft', (roomId, participantId) => {
      const currentRoom = this.roomManager.getCurrentRoom();
      if (currentRoom && currentRoom.id === roomId) {
        this.statusBarManager.showTemporaryMessage('参与者离开房间', 'info');
      }
    });

    // 监听录制状态变化
    this.recordingManager.onRecordingStateChange((state) => {
      this.statusBarManager.updateRecordingStatus(state);
    });

    // 监听播放状态变化
    this.playbackManager.onPlaybackStateChange((state) => {
      this.statusBarManager.updatePlaybackStatus(state);
    });
  }

  /**
   * 开始直播（兼容现有功能）
   */
  async startHosting(): Promise<void> {
    if (this.host) {
      vscode.window.showWarningMessage('Live Code: 已在直播中');
      return;
    }
    if (this.viewer) {
      vscode.window.showWarningMessage(
        'Live Code: 当前处于观看模式，请先断开连接'
      );
      return;
    }

    const config = vscode.workspace.getConfiguration('liveCodeViewer');
    const port = config.get<number>('port', 3456);

    this.host = new Host(port);
    try {
      await this.host.start();
      
      // 创建默认房间
      const defaultRoom = this.roomManager.createRoom({
        name: '默认直播房间',
        type: 'public'
      });
      
      this.roomManager.setCurrentRoom(defaultRoom.id);
      
      // 更新状态栏
      this.statusBarManager.updateHostingStatus(true);
      this.statusBarManager.showTemporaryMessage('直播已开始');
      
      // 启动性能监控
      this.performanceMonitor.startMonitoring();
      
      // 跟踪使用数据
      this.usageTracker.trackCommandUsage('startHosting');
      this.usageTracker.trackRoomCreated('public', false);
      
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Live Code: 启动失败 - ${err.message}`
      );
      this.usageTracker.trackError('host_start_failed', err.message);
      this.host.dispose();
      this.host = null;
    }
  }

  /**
   * 停止直播
   */
  stopHosting(): void {
    if (!this.host) {
      vscode.window.showWarningMessage('Live Code: 当前未在直播');
      return;
    }
    
    // 关闭当前房间
    const currentRoom = this.roomManager.getCurrentRoom();
    if (currentRoom) {
      this.roomManager.closeRoom(currentRoom.id);
    }
    
    this.host.dispose();
    this.host = null;
    
    // 更新状态栏
    this.statusBarManager.updateHostingStatus(false);
    this.statusBarManager.showTemporaryMessage('直播已停止');
  }

  /**
   * 复制直播地址
   */
  copyAddress(): void {
    if (!this.host) {
      vscode.window.showWarningMessage('Live Code: 当前未在直播');
      return;
    }
    
    try {
      const address = this.host.getBroadcastAddress();
      vscode.env.clipboard.writeText(address).then(() => {
        vscode.window.showInformationMessage(
          `Live Code: 已复制直播地址 "${address}" 到剪贴板`
        );
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Live Code: 复制地址失败 - ${err.message}`
      );
    }
  }

  /**
   * 连接到主播
   */
  async connectToHost(): Promise<void> {
    if (this.viewer) {
      vscode.window.showWarningMessage('Live Code: 已连接到主播');
      return;
    }
    if (this.host) {
      vscode.window.showWarningMessage(
        'Live Code: 当前处于直播模式，请先停止直播'
      );
      return;
    }

    const address = await vscode.window.showInputBox({
      prompt: '输入主播地址 (IP:端口)',
      placeHolder: '192.168.1.100:3456',
      validateInput: (value) => {
        if (!value.match(/^[\w.\-]+:\d+$/)) {
          return '请输入有效地址，格式: IP:端口 (例如 192.168.1.100:3456)';
        }
        return null;
      },
    });

    if (!address) { return; }

    this.viewer = new Viewer(this.documentProvider, this.treeProvider, this.treeView);
    this.viewer.onDisconnect = () => {
      this.viewer = null;
    };

    try {
      await this.viewer.connect(address);
      
      // 使用新的连接管理器建立连接
      const [host, portStr] = address.split(':');
      const port = parseInt(portStr, 10);
      
      await this.connectionManager.connect({
        host,
        port,
        protocol: 'ws'
      });
      
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Live Code: 连接失败 - ${err.message}`
      );
      this.viewer.dispose();
      this.viewer = null;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (!this.viewer) {
      vscode.window.showWarningMessage('Live Code: 当前未连接');
      return;
    }
    
    this.connectionManager.disconnect();
    this.viewer.dispose();
    this.viewer = null;
    vscode.window.showInformationMessage('Live Code: 已断开连接');
  }

  /**
   * 获取连接管理器
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * 获取房间管理器
   */
  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  /**
   * 获取权限管理器
   */
  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    isHosting: boolean;
    isViewing: boolean;
    connectionStatus: any;
    currentRoom: any;
  } {
    return {
      isHosting: this.host !== null,
      isViewing: this.viewer !== null,
      connectionStatus: this.connectionManager.getStatus(),
      currentRoom: this.roomManager.getCurrentRoom()
    };
  }

  /**
   * v0.1.1 新增功能方法
   */

  /**
   * 显示参与者面板
   */
  showParticipantPanel(): void {
    this.participantStatusManager.showParticipantPanel();
  }

  /**
   * 显示性能监控面板
   */
  showPerformancePanel(): void {
    this.performancePanel.show();
  }

  /**
   * 显示错误报告
   */
  showErrorReport(): void {
    this.errorHandler.showErrorReport();
  }

  /**
   * 显示快捷键帮助
   */
  showShortcutHelp(): void {
    this.shortcutManager.showHelp();
  }

  /**
   * 获取错误处理器
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * 获取主题适配器
   */
  getThemeAdapter(): ThemeAdapter {
    return this.themeAdapter;
  }

  /**
   * v0.1.2 新增协作编辑功能
   */

  /**
   * 启用协作编辑
   */
  enableCollaborativeEditing(): void {
    this.collaborationManager.enableCollaboration();
    this.statusBarManager.showTemporaryMessage('协作编辑已启用');
  }

  /**
   * 禁用协作编辑
   */
  disableCollaborativeEditing(): void {
    this.collaborationManager.disableCollaboration();
    this.statusBarManager.showTemporaryMessage('协作编辑已禁用');
  }

  /**
   * 显示协作状态面板
   */
  showCollaborationPanel(): void {
    this.collaborationManager.createCollaborationPanel();
  }

  /**
   * 获取协作统计信息
   */
  getCollaborationStats(): any {
    return this.collaborationManager.getCollaborationStats();
  }

  // ============ 录制功能 ============

  /**
   * 开始录制
   */
  async startRecording(): Promise<void> {
    const state = this.recordingManager.getRecordingState();
    if (state.isRecording) {
      vscode.window.showWarningMessage('Live Code: 正在录制中');
      return;
    }

    const title = await vscode.window.showInputBox({
      prompt: '输入录制标题（可选）',
      placeHolder: `录制 - ${new Date().toLocaleString()}`,
    });

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await this.recordingManager.startRecording(sessionId, title || undefined);
      this.statusBarManager.showTemporaryMessage('录制已开始');
      this.usageTracker.trackCommandUsage('startRecording');
    } catch (err: any) {
      vscode.window.showErrorMessage(`Live Code: 开始录制失败 - ${err.message}`);
    }
  }

  /**
   * 停止录制
   */
  async stopRecording(): Promise<void> {
    const state = this.recordingManager.getRecordingState();
    if (!state.isRecording) {
      vscode.window.showWarningMessage('Live Code: 当前未在录制');
      return;
    }

    try {
      const session = await this.recordingManager.stopRecording();
      await this.sessionStorage.saveSession(session);

      const duration = ((session.endTime - session.startTime) / 1000).toFixed(1);
      vscode.window.showInformationMessage(
        `Live Code: 录制完成 - ${session.operations.length} 个操作, 时长 ${duration}s`
      );
      this.usageTracker.trackCommandUsage('stopRecording');
    } catch (err: any) {
      vscode.window.showErrorMessage(`Live Code: 停止录制失败 - ${err.message}`);
    }
  }

  /**
   * 暂停录制
   */
  async pauseRecording(): Promise<void> {
    const state = this.recordingManager.getRecordingState();
    if (!state.isRecording || state.isPaused) {
      return;
    }

    await this.recordingManager.pauseRecording();
    this.statusBarManager.showTemporaryMessage('录制已暂停');
  }

  /**
   * 恢复录制
   */
  async resumeRecording(): Promise<void> {
    const state = this.recordingManager.getRecordingState();
    if (!state.isRecording || !state.isPaused) {
      return;
    }

    await this.recordingManager.resumeRecording();
    this.statusBarManager.showTemporaryMessage('录制已恢复');
  }

  /**
   * 获取录制管理器
   */
  getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  /**
   * 获取会话存储
   */
  getSessionStorage(): SessionStorage {
    return this.sessionStorage;
  }

  /**
   * 获取播放管理器
   */
  getPlaybackManager(): PlaybackManager {
    return this.playbackManager;
  }

  // ============ 播放功能方法 ============

  /**
   * 开始播放录制会话
   */
  async startPlayback(sessionId: string): Promise<void> {
    try {
      // 加载会话
      const session = await this.sessionStorage.loadSession(sessionId);
      if (!session) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }

      // 加载会话到播放管理器
      await this.playbackManager.loadSession(session);
      
      // 开始播放
      await this.playbackManager.play();
      this.statusBarManager.showTemporaryMessage(`开始播放: ${session.title || sessionId}`);
      this.usageTracker.trackCommandUsage('startPlayback');
    } catch (error: any) {
      vscode.window.showErrorMessage(`播放失败: ${error.message}`);
    }
  }

  /**
   * 停止播放
   */
  async stopPlayback(): Promise<void> {
    try {
      await this.playbackManager.stop();
      this.statusBarManager.showTemporaryMessage('播放已停止');
      this.usageTracker.trackCommandUsage('stopPlayback');
    } catch (error: any) {
      vscode.window.showErrorMessage(`停止播放失败: ${error.message}`);
    }
  }

  /**
   * 暂停播放
   */
  async pausePlayback(): Promise<void> {
    try {
      await this.playbackManager.pause();
      this.statusBarManager.showTemporaryMessage('播放已暂停');
      this.usageTracker.trackCommandUsage('pausePlayback');
    } catch (error: any) {
      vscode.window.showErrorMessage(`暂停播放失败: ${error.message}`);
    }
  }

  /**
   * 恢复播放
   */
  async resumePlayback(): Promise<void> {
    try {
      await this.playbackManager.resume();
      this.statusBarManager.showTemporaryMessage('播放已恢复');
      this.usageTracker.trackCommandUsage('resumePlayback');
    } catch (error: any) {
      vscode.window.showErrorMessage(`恢复播放失败: ${error.message}`);
    }
  }

  /**
   * 跳转到指定时间
   */
  async seekPlayback(time: number): Promise<void> {
    try {
      await this.playbackManager.seek(time);
      this.usageTracker.trackCommandUsage('seekPlayback');
    } catch (error: any) {
      vscode.window.showErrorMessage(`跳转失败: ${error.message}`);
    }
  }

  /**
   * 设置播放速度
   */
  async setPlaybackSpeed(speed: number): Promise<void> {
    try {
      await this.playbackManager.setSpeed(speed);
      this.statusBarManager.showTemporaryMessage(`播放速度: ${speed}x`);
      this.usageTracker.trackCommandUsage('setPlaybackSpeed');
    } catch (error: any) {
      vscode.window.showErrorMessage(`设置速度失败: ${error.message}`);
    }
  }

  /**
   * 获取会话列表
   */
  async getSessionList(): Promise<Array<{id: string, title: string, createdAt: number, duration: number}>> {
    try {
      const sessions = await this.sessionStorage.listSessions();
      return sessions.map(session => ({
        id: session.id,
        title: session.title || `会话 ${session.id.substring(0, 8)}`,
        createdAt: session.startTime,
        duration: session.duration || 0
      }));
    } catch (error: any) {
      vscode.window.showErrorMessage(`获取会话列表失败: ${error.message}`);
      return [];
    }
  }

  dispose(): void {
    this.connectionManager.dispose();
    this.roomManager.dispose();
    
    // v0.1.1 新增模块销毁
    this.cursorSyncManager.dispose();
    this.participantStatusManager.dispose();
    this.collaborationManager.dispose();
    this.shortcutManager.dispose();
    this.themeAdapter.dispose();
    this.performancePanel.dispose();
    this.errorHandler.dispose();
    
    // 录制模块销毁
    this.recordingManager.dispose();
    this.sessionStorage.dispose();
    this.playbackManager.dispose();
    this.performanceMonitor.dispose();
    
    this.host?.dispose();
    this.host = null;
    
    this.viewer?.dispose();
    this.viewer = null;
  }
}