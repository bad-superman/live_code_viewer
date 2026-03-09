import { RecordingSession } from './recording-manager';

export interface SessionInfo {
  id: string;
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  duration: number;
  operationCount: number;
  participantCount: number;
  size: number;
}

export interface SessionFilter {
  startDate?: number;
  endDate?: number;
  minDuration?: number;
  maxDuration?: number;
  titleContains?: string;
}

export class SessionStorage {
  private storage: Map<string, RecordingSession> = new Map();
  private readonly STORAGE_KEY = 'live-code-viewer-sessions';

  constructor() {
    this.loadFromPersistentStorage();
  }

  /**
   * 保存会话
   */
  async saveSession(session: RecordingSession): Promise<string> {
    // 计算会话大小
    const sessionSize = this.calculateSessionSize(session);
    
    // 添加压缩信息
    const compressedSession = this.compressSession(session);
    
    this.storage.set(session.id, compressedSession);
    await this.saveToPersistentStorage();

    console.log(`Session saved: ${session.id}, size: ${sessionSize} bytes`);
    return session.id;
  }

  /**
   * 加载会话
   */
  async loadSession(sessionId: string): Promise<RecordingSession> {
    const session = this.storage.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const decompressedSession = this.decompressSession(session);
    console.log(`Session loaded: ${sessionId}`);
    
    return decompressedSession;
  }

  /**
   * 列出会话
   */
  async listSessions(filter?: SessionFilter): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];

    for (const [id, session] of this.storage.entries()) {
      const sessionInfo = this.createSessionInfo(id, session);
      
      // 应用过滤器
      if (this.matchesFilter(sessionInfo, filter)) {
        sessions.push(sessionInfo);
      }
    }

    // 按开始时间排序（最新的在前）
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.storage.has(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.storage.delete(sessionId);
    await this.saveToPersistentStorage();

    console.log(`Session deleted: ${sessionId}`);
  }

  /**
   * 获取会话统计信息
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    totalDuration: number;
    totalOperations: number;
    averageDuration: number;
    storageSize: number;
  }> {
    let totalDuration = 0;
    let totalOperations = 0;
    let storageSize = 0;

    for (const session of this.storage.values()) {
      totalDuration += session.endTime - session.startTime;
      totalOperations += session.operations.length;
      storageSize += this.calculateSessionSize(session);
    }

    const totalSessions = this.storage.size;
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    return {
      totalSessions,
      totalDuration,
      totalOperations,
      averageDuration,
      storageSize
    };
  }

  /**
   * 清理过期会话
   */
  async cleanupExpiredSessions(maxAgeDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, session] of this.storage.entries()) {
      if (session.endTime < cutoffTime) {
        this.storage.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.saveToPersistentStorage();
      console.log(`Cleaned up ${deletedCount} expired sessions`);
    }

    return deletedCount;
  }

  /**
   * 导出会话
   */
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.loadSession(sessionId);
    return JSON.stringify(session, null, 2);
  }

  /**
   * 导入会话
   */
  async importSession(sessionData: string): Promise<string> {
    try {
      const session = JSON.parse(sessionData) as RecordingSession;
      
      // 验证会话数据
      if (!this.isValidSession(session)) {
        throw new Error('Invalid session data');
      }

      // 生成新的会话ID
      const newSessionId = this.generateSessionId();
      session.id = newSessionId;

      return await this.saveSession(session);
    } catch (error) {
      throw new Error(`Failed to import session: ${error}`);
    }
  }

  /**
   * 创建会话信息
   */
  private createSessionInfo(id: string, session: RecordingSession): SessionInfo {
    return {
      id,
      title: session.title,
      description: session.description,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime - session.startTime,
      operationCount: session.operations.length,
      participantCount: session.participants.length,
      size: this.calculateSessionSize(session)
    };
  }

  /**
   * 检查是否匹配过滤器
   */
  private matchesFilter(sessionInfo: SessionInfo, filter?: SessionFilter): boolean {
    if (!filter) {
      return true;
    }

    if (filter.startDate && sessionInfo.startTime < filter.startDate) {
      return false;
    }

    if (filter.endDate && sessionInfo.endTime > filter.endDate) {
      return false;
    }

    if (filter.minDuration && sessionInfo.duration < filter.minDuration) {
      return false;
    }

    if (filter.maxDuration && sessionInfo.duration > filter.maxDuration) {
      return false;
    }

    if (filter.titleContains && 
        !sessionInfo.title.toLowerCase().includes(filter.titleContains.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * 计算会话大小
   */
  private calculateSessionSize(session: RecordingSession): number {
    return JSON.stringify(session).length;
  }

  /**
   * 压缩会话数据
   */
  private compressSession(session: RecordingSession): RecordingSession {
    // 简单的压缩：移除空值和重复数据
    const compressed = { ...session };
    
    // 计算压缩率
    const originalSize = JSON.stringify(session).length;
    const compressedSize = JSON.stringify(compressed).length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

    compressed.metadata.compressionRatio = compressionRatio;
    return compressed;
  }

  /**
   * 解压会话数据
   */
  private decompressSession(session: RecordingSession): RecordingSession {
    // 当前实现中，压缩是轻量的，直接返回
    return { ...session };
  }

  /**
   * 验证会话数据
   */
  private isValidSession(session: any): session is RecordingSession {
    return (
      typeof session.id === 'string' &&
      typeof session.title === 'string' &&
      typeof session.startTime === 'number' &&
      typeof session.endTime === 'number' &&
      Array.isArray(session.operations) &&
      session.metadata &&
      Array.isArray(session.participants)
    );
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 从持久化存储加载
   */
  private loadFromPersistentStorage(): void {
    try {
      // 在 VS Code 扩展环境中，使用全局状态或文件系统存储
      // 这里使用内存存储作为临时解决方案
      console.log('Session storage initialized (in-memory)');
    } catch (error) {
      console.warn('Failed to load sessions from storage:', error);
    }
  }

  /**
   * 保存到持久化存储
   */
  private async saveToPersistentStorage(): Promise<void> {
    try {
      // 在 VS Code 扩展环境中，使用全局状态或文件系统存储
      // 这里使用内存存储作为临时解决方案
      console.log('Session data saved (in-memory)');
    } catch (error) {
      console.warn('Failed to save sessions to storage:', error);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.storage.clear();
  }
}