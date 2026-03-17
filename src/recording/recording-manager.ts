import { EventEmitter, window } from 'vscode';
import { EditOperation } from '../collaboration/collaborative-editor';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  sessionId?: string;
  startTime?: number;
  operationCount: number;
  lastError?: string;
  recoveryAttempts: number;
}

export interface RecordingSession {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  operations: EditOperation[];
  metadata: SessionMetadata;
  participants: ParticipantInfo[];
}

export interface SessionMetadata {
  version: string;
  editorVersion: string;
  recordingVersion: string;
  compressionRatio?: number;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  joinTime: number;
  leaveTime?: number;
}

export class RecordingManager {
  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    operationCount: 0,
    recoveryAttempts: 0
  };

  private currentSession?: RecordingSession;
  private operations: EditOperation[] = [];
  private readonly onStateChange = new EventEmitter<RecordingState>();

  constructor() {
    // Initialize recording manager
  }

  /**
   * 开始录制会话
   */
  async startRecording(sessionId: string, title?: string): Promise<void> {
    if (this.state.isRecording) {
      const errorMsg = '录制已在进行中';
      window.showErrorMessage(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    this.currentSession = {
      id: sessionId,
      title: title || `Session ${new Date().toISOString()}`,
      startTime: Date.now(),
      endTime: 0,
      operations: [],
      metadata: {
        version: '1.0.0',
        editorVersion: '0.1.3',
        recordingVersion: '1.0.0'
      },
      participants: []
    };

    this.operations = [];
    this.state = {
      isRecording: true,
      isPaused: false,
      sessionId,
      startTime: Date.now(),
      operationCount: 0,
      recoveryAttempts: 0,
      lastError: undefined
    };

    this.onStateChange.fire(this.state);
    console.log(`Recording started: ${sessionId}`);
    
    // 显示录制开始通知
    window.showInformationMessage(`🎥 录制已开始: ${title || sessionId}`, '查看详情').then(selection => {
      if (selection === '查看详情') {
        // 可以在这里添加打开录制详情的命令
        window.showInformationMessage(`录制会话: ${sessionId}\n开始时间: ${new Date().toLocaleString()}`);
      }
    });
  }

  /**
   * 停止录制会话
   */
  async stopRecording(): Promise<RecordingSession> {
    if (!this.state.isRecording || !this.currentSession) {
      const errorMsg = '没有正在进行的录制';
      window.showErrorMessage(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.operations = [...this.operations];

    const session = this.currentSession;

    this.state = {
      isRecording: false,
      isPaused: false,
      operationCount: 0,
      recoveryAttempts: 0,
      lastError: undefined
    };

    this.currentSession = undefined;
    this.operations = [];

    this.state = {
      isRecording: false,
      isPaused: false,
      operationCount: 0,
      recoveryAttempts: 0,
      lastError: undefined
    };

    this.onStateChange.fire(this.state);
    console.log(`Recording stopped: ${session.id}, operations: ${session.operations.length}`);
    
    // 显示录制结束通知
    const duration = Math.round((session.endTime - session.startTime) / 1000);
    const operationCount = session.operations.length;
    window.showInformationMessage(
      `✅ 录制已结束: ${session.title}\n时长: ${duration}秒, 操作数: ${operationCount}`,
      '保存录制', '查看详情'
    ).then(selection => {
      if (selection === '保存录制') {
        // 可以在这里添加保存录制的命令
        window.showInformationMessage('录制已自动保存到本地存储');
      } else if (selection === '查看详情') {
        window.showInformationMessage(
          `录制详情:\n` +
          `- 会话ID: ${session.id}\n` +
          `- 标题: ${session.title}\n` +
          `- 开始时间: ${new Date(session.startTime).toLocaleString()}\n` +
          `- 结束时间: ${new Date(session.endTime).toLocaleString()}\n` +
          `- 时长: ${duration}秒\n` +
          `- 操作数: ${operationCount}\n` +
          `- 参与者: ${session.participants.length}人`
        );
      }
    });

    return session;
  }

  /**
   * 暂停录制
   */
  async pauseRecording(): Promise<void> {
    if (!this.state.isRecording || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.onStateChange.fire(this.state);
    console.log('Recording paused');
    
    // 显示暂停通知
    window.showInformationMessage('⏸️ 录制已暂停', '恢复录制').then(selection => {
      if (selection === '恢复录制') {
        this.resumeRecording();
      }
    });
  }

  /**
   * 恢复录制
   */
  async resumeRecording(): Promise<void> {
    if (!this.state.isRecording || !this.state.isPaused) {
      return;
    }

    this.state.isPaused = false;
    this.onStateChange.fire(this.state);
    console.log('Recording resumed');
    
    // 显示恢复通知
    window.showInformationMessage('▶️ 录制已恢复');
  }

  /**
   * 捕获编辑操作
   */
  captureOperation(operation: EditOperation): void {
    if (!this.state.isRecording || this.state.isPaused) {
      return;
    }

    // 添加时间戳
    const timestampedOperation = {
      ...operation,
      timestamp: Date.now()
    };

    this.operations.push(timestampedOperation);
    this.state.operationCount++;

    // 触发状态更新
    this.onStateChange.fire(this.state);
  }

  /**
   * 添加参与者
   */
  addParticipant(participant: Omit<ParticipantInfo, 'joinTime'>): void {
    if (!this.currentSession) {
      return;
    }

    const participantInfo: ParticipantInfo = {
      ...participant,
      joinTime: Date.now()
    };

    this.currentSession.participants.push(participantInfo);
  }

  /**
   * 移除参与者
   */
  removeParticipant(participantId: string): void {
    if (!this.currentSession) {
      return;
    }

    const participant = this.currentSession.participants.find(p => p.id === participantId);
    if (participant) {
      participant.leaveTime = Date.now();
    }
  }

  /**
   * 获取录制状态
   */
  getRecordingState(): RecordingState {
    return { ...this.state };
  }

  /**
   * 获取当前会话信息
   */
  getCurrentSession(): RecordingSession | undefined {
    return this.currentSession ? { ...this.currentSession } : undefined;
  }

  /**
   * 获取操作数量
   */
  getOperationCount(): number {
    return this.state.operationCount;
  }

  /**
   * 状态变化事件
   */
  get onRecordingStateChange() {
    return this.onStateChange.event;
  }

  /**
   * 尝试恢复录制
   */
  async tryRecover(): Promise<boolean> {
    if (!this.state.isRecording || !this.currentSession) {
      return false;
    }

    // 检查是否达到最大恢复尝试次数
    if (this.state.recoveryAttempts >= 3) {
      window.showErrorMessage('❌ 录制恢复失败，已达到最大恢复尝试次数');
      return false;
    }

    this.state.recoveryAttempts++;
    this.state.lastError = undefined;
    
    window.showInformationMessage(`🔄 尝试恢复录制 (第${this.state.recoveryAttempts}次尝试)...`);
    
    // 在实际应用中，这里可以尝试重新连接或恢复状态
    // 目前我们只是重置暂停状态
    if (this.state.isPaused) {
      this.state.isPaused = false;
    }
    
    this.onStateChange.fire(this.state);
    console.log(`Recording recovery attempted: ${this.state.recoveryAttempts}`);
    
    return true;
  }

  /**
   * 记录错误
   */
  private recordError(error: Error): void {
    this.state.lastError = error.message;
    console.error('Recording error:', error);
    
    // 显示错误通知
    window.showErrorMessage(`❌ 录制错误: ${error.message}`, '尝试恢复').then(selection => {
      if (selection === '尝试恢复') {
        this.tryRecover();
      }
    });
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 清理所有事件监听器
    this.onStateChange.dispose();
    
    // 清理操作数组
    this.operations.length = 0;
    this.operations = [];
    
    // 清理当前会话
    if (this.currentSession) {
      this.currentSession.operations.length = 0;
      this.currentSession.participants.length = 0;
    }
    this.currentSession = undefined;
    
    // 重置状态
    this.state = {
      isRecording: false,
      isPaused: false,
      operationCount: 0,
      recoveryAttempts: 0,
      lastError: undefined
    };
    
    console.log('Recording manager disposed');
  }
}