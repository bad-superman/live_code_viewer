import { EventEmitter } from 'vscode';

export interface PerformanceMetrics {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  recordingOperations: number;
  playbackOperations: number;
  networkLatency?: number;
  connectionQuality?: string;
}

export interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'latency' | 'operations';
  level: 'warning' | 'error';
  message: string;
  metric: PerformanceMetrics;
  timestamp: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetrics = 1000; // 保留最近1000个指标
  private readonly onAlert = new EventEmitter<PerformanceAlert>();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor() {
    // 初始化性能监控器
  }

  /**
   * 开始监控
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('Performance monitoring started');
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        recordingOperations: 0,
        playbackOperations: 0
      };

      // 在实际应用中，这里可以添加录制和播放操作数
      // 目前我们只收集系统指标

      this.metrics.push(metrics);

      // 限制指标数量
      if (this.metrics.length > this.maxMetrics) {
        this.metrics = this.metrics.slice(-this.maxMetrics);
      }

      // 检查性能问题
      this.checkPerformanceIssues(metrics);

    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * 检查性能问题
   */
  private checkPerformanceIssues(metrics: PerformanceMetrics): void {
    // 检查内存使用
    const memoryUsage = metrics.memoryUsage;
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (memoryUsagePercent > 0.9) {
      this.emitAlert({
        type: 'memory',
        level: 'error',
        message: `内存使用过高: ${Math.round(memoryUsagePercent * 100)}% (${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB)`,
        metric: metrics,
        timestamp: Date.now()
      });
    } else if (memoryUsagePercent > 0.7) {
      this.emitAlert({
        type: 'memory',
        level: 'warning',
        message: `内存使用较高: ${Math.round(memoryUsagePercent * 100)}%`,
        metric: metrics,
        timestamp: Date.now()
      });
    }

    // 检查CPU使用
    // 注意：process.cpuUsage()返回的是微秒，需要与前一次比较
    if (this.metrics.length >= 2) {
      const prevMetrics = this.metrics[this.metrics.length - 2];
      const cpuDelta = metrics.cpuUsage.user - prevMetrics.cpuUsage.user;
      const timeDelta = metrics.timestamp - prevMetrics.timestamp;
      
      if (timeDelta > 0) {
        const cpuPercent = (cpuDelta / (timeDelta * 1000)) * 100; // 转换为百分比
        
        if (cpuPercent > 80) {
          this.emitAlert({
            type: 'cpu',
            level: 'error',
            message: `CPU使用过高: ${Math.round(cpuPercent)}%`,
            metric: metrics,
            timestamp: Date.now()
          });
        } else if (cpuPercent > 50) {
          this.emitAlert({
            type: 'cpu',
            level: 'warning',
            message: `CPU使用较高: ${Math.round(cpuPercent)}%`,
            metric: metrics,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  /**
   * 发出性能警报
   */
  private emitAlert(alert: PerformanceAlert): void {
    console.log(`Performance alert: ${alert.type} - ${alert.level} - ${alert.message}`);
    this.onAlert.fire(alert);
  }

  /**
   * 获取最近指标
   */
  getRecentMetrics(count: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgCpuUsage: number;
    alertCount: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgCpuUsage: 0,
        alertCount: 0
      };
    }

    let totalMemoryPercent = 0;
    let maxMemoryPercent = 0;

    this.metrics.forEach(metric => {
      const memoryPercent = metric.memoryUsage.heapUsed / metric.memoryUsage.heapTotal;
      totalMemoryPercent += memoryPercent;
      maxMemoryPercent = Math.max(maxMemoryPercent, memoryPercent);
    });

    return {
      avgMemoryUsage: totalMemoryPercent / this.metrics.length,
      maxMemoryUsage: maxMemoryPercent,
      avgCpuUsage: 0, // 需要更复杂的计算
      alertCount: 0 // 需要跟踪警报数量
    };
  }

  /**
   * 警报事件
   */
  get onPerformanceAlert() {
    return this.onAlert.event;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopMonitoring();
    this.onAlert.dispose();
    this.metrics = [];
    console.log('Performance monitor disposed');
  }
}