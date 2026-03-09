import { EventEmitter } from 'vscode';
import { EditOperation } from '../collaboration/collaborative-editor';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  sessionId?: string;
  startTime?: number;
  operationCount: number;
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
    operationCount: 0
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
      throw new Error('Recording already in progress');
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
      operationCount: 0
    };

    this.onStateChange.fire(this.state);
    console.log(`Recording started: ${sessionId}`);
  }

  /**
   * 停止录制会话
   */
  async stopRecording(): Promise<RecordingSession> {
    if (!this.state.isRecording || !this.currentSession) {
      throw new Error('No recording in progress');
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.operations = [...this.operations];

    const session = this.currentSession;

    this.state = {
      isRecording: false,
      isPaused: false,
      operationCount: 0
    };

    this.currentSession = undefined;
    this.operations = [];

    this.onStateChange.fire(this.state);
    console.log(`Recording stopped: ${session.id}, operations: ${session.operations.length}`);

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
   * 清理资源
   */
  dispose(): void {
    this.onStateChange.dispose();
    this.operations = [];
    this.currentSession = undefined;
    this.state = {
      isRecording: false,
      isPaused: false,
      operationCount: 0
    };
  }
}