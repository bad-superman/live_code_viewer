import * as vscode from 'vscode';

export interface ConnectionStats {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageLatency: number;
  lastError?: string;
  lastErrorTime?: number;
}

export class ConnectionStabilizer {
  private connectionStats: ConnectionStats = {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    averageLatency: 0
  };
  
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000; // 1秒
  private maxDelay = 30000; // 30秒
  
  private latencyMeasurements: number[] = [];
  private readonly maxLatencySamples = 10;

  constructor() {}

  /**
   * 智能重连策略
   */
  async smartReconnect(
    connectFunction: () => Promise<boolean>,
    onProgress?: (progress: { attempt: number; delay: number; message: string }) => void
  ): Promise<boolean> {
    this.retryCount = 0;
    
    while (this.retryCount < this.maxRetries) {
      try {
        const delay = this.calculateRetryDelay();
        
        if (onProgress) {
          onProgress({
            attempt: this.retryCount + 1,
            delay,
            message: `尝试重新连接 (${this.retryCount + 1}/${this.maxRetries})`
          });
        }

        // 等待重连延迟
        await this.delay(delay);

        // 尝试连接
        const startTime = Date.now();
        const success = await connectFunction();
        const latency = Date.now() - startTime;

        if (success) {
          this.recordSuccess(latency);
          return true;
        } else {
          this.recordFailure('连接失败');
        }
      } catch (error) {
        this.recordFailure(error instanceof Error ? error.message : '未知错误');
      }

      this.retryCount++;
    }

    return false;
  }

  /**
   * 计算重连延迟（指数退避）
   */
  private calculateRetryDelay(): number {
    const delay = this.baseDelay * Math.pow(2, this.retryCount);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 记录成功连接
   */
  private recordSuccess(latency: number): void {
    this.connectionStats.totalConnections++;
    this.connectionStats.successfulConnections++;
    
    // 更新延迟统计
    this.latencyMeasurements.push(latency);
    if (this.latencyMeasurements.length > this.maxLatencySamples) {
      this.latencyMeasurements.shift();
    }
    
    this.connectionStats.averageLatency = 
      this.latencyMeasurements.reduce((sum, lat) => sum + lat, 0) / 
      this.latencyMeasurements.length;
    
    this.retryCount = 0; // 重置重试计数
  }

  /**
   * 记录连接失败
   */
  private recordFailure(error: string): void {
    this.connectionStats.totalConnections++;
    this.connectionStats.failedConnections++;
    this.connectionStats.lastError = error;
    this.connectionStats.lastErrorTime = Date.now();
  }

  /**
   * 获取连接质量评估
   */
  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const successRate = this.connectionStats.successfulConnections / this.connectionStats.totalConnections;
    const avgLatency = this.connectionStats.averageLatency;

    if (successRate >= 0.95 && avgLatency < 100) {
      return 'excellent';
    } else if (successRate >= 0.9 && avgLatency < 200) {
      return 'good';
    } else if (successRate >= 0.8 && avgLatency < 500) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * 获取连接统计
   */
  getConnectionStats(): ConnectionStats {
    return { ...this.connectionStats };
  }

  /**
   * 网络状态检测
   */
  async checkNetworkStatus(): Promise<{
    isOnline: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // 简单的网络检测 - 可以替换为实际的网络检测逻辑
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD'
      });
      
      const latency = Date.now() - startTime;
      
      return {
        isOnline: response.ok,
        latency
      };
    } catch (error) {
      return {
        isOnline: false,
        error: error instanceof Error ? error.message : '网络检测失败'
      };
    }
  }

  /**
   * 获取重连建议
   */
  getReconnectAdvice(): {
    shouldRetry: boolean;
    recommendedDelay: number;
    message: string;
  } {
    const successRate = this.connectionStats.successfulConnections / this.connectionStats.totalConnections;
    
    if (successRate < 0.5) {
      return {
        shouldRetry: false,
        recommendedDelay: 0,
        message: '连接成功率过低，建议检查网络设置'
      };
    } else if (this.retryCount >= this.maxRetries) {
      return {
        shouldRetry: false,
        recommendedDelay: 0,
        message: '已达到最大重试次数，请稍后再试'
      };
    } else {
      const delay = this.calculateRetryDelay();
      return {
        shouldRetry: true,
        recommendedDelay: delay,
        message: `建议 ${Math.ceil(delay / 1000)} 秒后重试`
      };
    }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.connectionStats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageLatency: 0
    };
    this.latencyMeasurements = [];
    this.retryCount = 0;
  }

  /**
   * 获取健康度报告
   */
  getHealthReport(): {
    overallHealth: 'healthy' | 'warning' | 'critical';
    metrics: {
      successRate: number;
      averageLatency: number;
      recentFailures: number;
    };
    recommendations: string[];
  } {
    const successRate = this.connectionStats.successfulConnections / this.connectionStats.totalConnections || 0;
    const recentFailures = this.connectionStats.failedConnections;
    
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    if (successRate < 0.7 || this.connectionStats.averageLatency > 1000) {
      overallHealth = 'critical';
      recommendations.push('连接稳定性严重问题，建议检查网络环境');
    } else if (successRate < 0.9 || this.connectionStats.averageLatency > 500) {
      overallHealth = 'warning';
      recommendations.push('连接质量一般，建议优化网络设置');
    }

    if (recentFailures > 0) {
      recommendations.push(`最近有 ${recentFailures} 次连接失败`);
    }

    return {
      overallHealth,
      metrics: {
        successRate,
        averageLatency: this.connectionStats.averageLatency,
        recentFailures
      },
      recommendations
    };
  }
}