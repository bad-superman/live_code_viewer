import * as vscode from 'vscode';

export interface UsageEvent {
  type: string;
  timestamp: Date;
  data?: any;
}

export class UsageTracker {
  private events: UsageEvent[] = [];
  private isEnabled: boolean = true;

  constructor(private context: vscode.ExtensionContext) {
    this.loadStoredEvents();
  }

  /**
   * 记录使用事件
   */
  trackEvent(type: string, data?: any): void {
    if (!this.isEnabled) return;

    const event: UsageEvent = {
      type,
      timestamp: new Date(),
      data
    };

    this.events.push(event);
    
    // 保持最近1000个事件
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    this.saveEvents();
  }

  /**
   * 记录房间创建事件
   */
  trackRoomCreated(roomType: string, hasPassword: boolean): void {
    this.trackEvent('room_created', {
      roomType,
      hasPassword
    });
  }

  /**
   * 记录连接事件
   */
  trackConnectionEvent(eventType: 'connected' | 'disconnected' | 'reconnected', duration?: number): void {
    this.trackEvent(`connection_${eventType}`, {
      duration
    });
  }

  /**
   * 记录命令使用
   */
  trackCommandUsage(command: string): void {
    this.trackEvent('command_used', {
      command
    });
  }

  /**
   * 记录错误事件
   */
  trackError(errorType: string, message: string): void {
    this.trackEvent('error', {
      errorType,
      message
    });
  }

  /**
   * 获取使用统计摘要
   */
  getUsageSummary(): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    recentActivity: UsageEvent[];
  } {
    const eventTypes: Record<string, number> = {};
    
    this.events.forEach(event => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });

    return {
      totalEvents: this.events.length,
      eventTypes,
      recentActivity: this.events.slice(-50) // 最近50个事件
    };
  }

  /**
   * 导出使用数据（用于分析）
   */
  exportData(): UsageEvent[] {
    return [...this.events];
  }

  /**
   * 清除所有数据
   */
  clearData(): void {
    this.events = [];
    this.context.globalState.update('usageEvents', []);
  }

  /**
   * 启用/禁用跟踪
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * 从存储加载事件
   */
  private loadStoredEvents(): void {
    try {
      const storedEvents = this.context.globalState.get<UsageEvent[]>('usageEvents', []);
      
      // 恢复日期对象
      this.events = storedEvents.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp)
      }));
    } catch (error) {
      console.error('加载使用数据失败:', error);
    }
  }

  /**
   * 保存事件到存储
   */
  private saveEvents(): void {
    try {
      this.context.globalState.update('usageEvents', this.events);
    } catch (error) {
      console.error('保存使用数据失败:', error);
    }
  }

  dispose(): void {
    this.saveEvents();
  }
}