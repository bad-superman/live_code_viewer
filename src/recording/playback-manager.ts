import { EventEmitter } from 'vscode';
import { RecordingSession } from './recording-manager';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  sessionId?: string;
}

export interface Timeline {
  sessionId: string;
  duration: number;
  events: TimelineEvent[];
  markers: TimelineMarker[];
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'operation' | 'participant' | 'comment';
  data: any;
  description?: string;
}

export interface TimelineMarker {
  id: string;
  timestamp: number;
  label: string;
  color?: string;
}

export interface ProgressInfo {
  currentTime: number;
  duration: number;
  progress: number; // 0-1
  speed: number;
  operationIndex: number;
  totalOperations: number;
}

export class PlaybackManager {
  private state: PlaybackState = {
    isPlaying: false,
    isPaused: false,
    currentTime: 0,
    duration: 0,
    speed: 1.0
  };

  private currentSession?: RecordingSession;
  private timeline?: Timeline;
  private playbackInterval?: NodeJS.Timeout;
  private readonly onStateChange = new EventEmitter<PlaybackState>();
  private readonly onTimeUpdate = new EventEmitter<number>();
  private readonly onProgress = new EventEmitter<ProgressInfo>();

  constructor() {
    // Initialize playback manager
  }

  /**
   * 加载会话
   */
  async loadSession(session: RecordingSession): Promise<void> {
    this.currentSession = session;
    this.timeline = this.createTimeline(session);
    
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: session.endTime - session.startTime,
      speed: 1.0,
      sessionId: session.id
    };

    this.onStateChange.fire(this.state);
    console.log(`Session loaded: ${session.id}, duration: ${this.state.duration}ms`);
  }

  /**
   * 开始播放
   */
  async play(): Promise<void> {
    if (this.state.isPlaying || !this.currentSession) {
      return;
    }

    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.onStateChange.fire(this.state);

    // 开始播放循环
    this.startPlaybackLoop();
    console.log('Playback started');
  }

  /**
   * 暂停播放
   */
  async pause(): Promise<void> {
    if (!this.state.isPlaying || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.onStateChange.fire(this.state);

    this.stopPlaybackLoop();
    console.log('Playback paused');
  }

  /**
   * 恢复播放
   */
  async resume(): Promise<void> {
    if (!this.state.isPlaying || !this.state.isPaused) {
      return;
    }

    this.state.isPaused = false;
    this.onStateChange.fire(this.state);

    this.startPlaybackLoop();
    console.log('Playback resumed');
  }

  /**
   * 停止播放
   */
  async stop(): Promise<void> {
    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.state.currentTime = 0;
    this.onStateChange.fire(this.state);

    this.stopPlaybackLoop();
    console.log('Playback stopped');
  }

  /**
   * 跳转到指定时间
   */
  async seek(timestamp: number): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const clampedTime = Math.max(0, Math.min(timestamp, this.state.duration));
    this.state.currentTime = clampedTime;
    
    // 如果正在播放，需要重新计算起始时间
    if (this.state.isPlaying && !this.state.isPaused) {
      this.stopPlaybackLoop();
      this.startPlaybackLoop();
    }
    
    this.onTimeUpdate.fire(this.state.currentTime);
    this.onStateChange.fire(this.state);

    console.log(`Seek to: ${clampedTime}ms`);
  }

  /**
   * 设置播放速度
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    this.state.speed = clampedSpeed;
    this.onStateChange.fire(this.state);

    // 重新启动播放循环以应用新的速度
    if (this.state.isPlaying && !this.state.isPaused) {
      this.stopPlaybackLoop();
      this.startPlaybackLoop();
    }

    console.log(`Playback speed set to: ${clampedSpeed}x`);
  }

  /**
   * 获取播放状态
   */
  getPlaybackState(): PlaybackState {
    return { ...this.state };
  }

  /**
   * 获取时间轴
   */
  getTimeline(): Timeline | undefined {
    return this.timeline ? { ...this.timeline } : undefined;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): RecordingSession | undefined {
    return this.currentSession ? { ...this.currentSession } : undefined;
  }

  /**
   * 获取当前操作
   */
  getCurrentOperations(): any[] {
    if (!this.currentSession) {
      return [];
    }

    const currentTimestamp = this.currentSession.startTime + this.state.currentTime;
    return this.currentSession.operations.filter(op => 
      op.timestamp <= currentTimestamp
    );
  }

  /**
   * 状态变化事件
   */
  get onPlaybackStateChange() {
    return this.onStateChange.event;
  }

  /**
   * 时间更新事件
   */
  get onPlaybackTimeUpdate() {
    return this.onTimeUpdate.event;
  }

  /**
   * 进度事件
   */
  get onPlaybackProgress() {
    return this.onProgress.event;
  }

  /**
   * 创建时间轴
   */
  private createTimeline(session: RecordingSession): Timeline {
    const events: TimelineEvent[] = [];
    const markers: TimelineMarker[] = [];

    // 添加操作事件
    session.operations.forEach((operation, index) => {
      const timestamp = operation.timestamp - session.startTime;
      events.push({
        id: `op-${index}`,
        timestamp,
        type: 'operation',
        data: operation,
        description: `${operation.type} operation`
      });
    });

    // 添加参与者事件
    session.participants.forEach(participant => {
      const joinTime = participant.joinTime - session.startTime;
      events.push({
        id: `join-${participant.id}`,
        timestamp: joinTime,
        type: 'participant',
        data: participant,
        description: `${participant.name} joined`
      });

      if (participant.leaveTime) {
        const leaveTime = participant.leaveTime - session.startTime;
        events.push({
          id: `leave-${participant.id}`,
          timestamp: leaveTime,
          type: 'participant',
          data: participant,
          description: `${participant.name} left`
        });
      }
    });

    // 添加时间标记
    const quarterDuration = session.endTime - session.startTime;
    [0.25, 0.5, 0.75].forEach(ratio => {
      const timestamp = quarterDuration * ratio;
      markers.push({
        id: `marker-${ratio}`,
        timestamp,
        label: `${Math.round(ratio * 100)}%`,
        color: '#007acc'
      });
    });

    return {
      sessionId: session.id,
      duration: quarterDuration,
      events: events.sort((a, b) => a.timestamp - b.timestamp),
      markers
    };
  }

  /**
   * 开始播放循环
   */
  private startPlaybackLoop(): void {
    if (this.playbackInterval) {
      return;
    }

    const updateInterval = 16; // 约60fps，提高响应速度
    const startTime = Date.now() - this.state.currentTime / this.state.speed;
    let lastUpdateTime = Date.now();

    this.playbackInterval = setInterval(() => {
      if (!this.state.isPlaying || this.state.isPaused || !this.currentSession) {
        return;
      }

      const now = Date.now();
      const delta = now - lastUpdateTime;
      lastUpdateTime = now;

      // 基于实际经过的时间计算进度，避免setInterval不精确
      const elapsed = (now - startTime) * this.state.speed;
      const newTime = Math.min(elapsed, this.state.duration);

      this.state.currentTime = newTime;
      this.onTimeUpdate.fire(newTime);
      
      // 发送进度信息
      this.fireProgressEvent(newTime);

      // 检查是否播放完成
      if (newTime >= this.state.duration) {
        this.stop();
      }
    }, updateInterval);
  }

  /**
   * 停止播放循环
   */
  private stopPlaybackLoop(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = undefined;
    }
  }

  /**
   * 发送进度事件
   */
  private fireProgressEvent(currentTime: number): void {
    if (!this.currentSession) {
      return;
    }

    const progress = this.state.duration > 0 ? currentTime / this.state.duration : 0;
    
    // 计算当前操作索引
    let operationIndex = 0;
    for (let i = 0; i < this.currentSession.operations.length; i++) {
      const op = this.currentSession.operations[i];
      const opTime = op.timestamp - this.currentSession.startTime;
      if (opTime <= currentTime) {
        operationIndex = i + 1;
      } else {
        break;
      }
    }

    const progressInfo: ProgressInfo = {
      currentTime,
      duration: this.state.duration,
      progress,
      speed: this.state.speed,
      operationIndex,
      totalOperations: this.currentSession.operations.length
    };

    this.onProgress.fire(progressInfo);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopPlaybackLoop();
    this.onStateChange.dispose();
    this.onTimeUpdate.dispose();
    this.onProgress.dispose();
    this.currentSession = undefined;
    this.timeline = undefined;
    this.state = {
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      duration: 0,
      speed: 1.0
    };
  }
}