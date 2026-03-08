/**
 * 性能监控增强模块
 * 实时性能指标监控和优化建议
 */

import * as vscode from 'vscode';
import { LatencyOptimizer, LatencyStats } from './latency-optimizer';
import { MemoryOptimizer, MemoryStats } from './memory-optimizer';
import { NetworkOptimizer, NetworkStats } from './network-optimizer';

export interface PerformanceMetrics {
  latency: LatencyStats;
  memory: MemoryStats;
  network: Map<string, NetworkStats>;
  overallScore: number;
  optimizationSuggestions: string[];
}

export interface PerformanceConfig {
  monitoringInterval: number;
  alertThreshold: number;
  enableAutoOptimization: boolean;
  performanceTargets: {
    latency: number;
    memory: number;
    networkSuccess: number;
  };
}

export class PerformanceMonitor {
  private config: PerformanceConfig = {
    monitoringInterval: 5000, // 5秒
    alertThreshold: 80, // 80% 性能阈值
    enableAutoOptimization: true,
    performanceTargets: {
      latency: 50, // 50ms
      memory: 80, // 80MB
      networkSuccess: 95 // 95%
    }
  };

  private latencyOptimizer: LatencyOptimizer;
  private memoryOptimizer: MemoryOptimizer;
  private networkOptimizer: NetworkOptimizer;

  private monitoringTimer?: NodeJS.Timeout;
  private currentMetrics: PerformanceMetrics = {
    latency: {
      averageLatency: 0,
      maxLatency: 0,
      minLatency: 0,
      operationCount: 0,
      optimizationRate: 0
    },
    memory: {
      totalOperations: 0,
      activeOperations: 0,
      memoryUsage: 0,
      garbageCollected: 0,
      optimizationRate: 0
    },
    network: new Map(),
    overallScore: 0,
    optimizationSuggestions: []
  };

  private eventEmitter = new vscode.EventEmitter<{
    type: 'metrics-update' | 'alert-triggered' | 'optimization-suggestion';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  constructor() {
    this.latencyOptimizer = new LatencyOptimizer();
    this.memoryOptimizer = new MemoryOptimizer();
    this.networkOptimizer = new NetworkOptimizer();

    this.setupMonitoring();
  }

  /**
   * 开始性能监控
   */
  startMonitoring(): void {
    this.setupMonitoring();
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * 获取延迟优化器
   */
  getLatencyOptimizer(): LatencyOptimizer {
    return this.latencyOptimizer;
  }

  /**
   * 获取内存优化器
   */
  getMemoryOptimizer(): MemoryOptimizer {
    return this.memoryOptimizer;
  }

  /**
   * 获取网络优化器
   */
  getNetworkOptimizer(): NetworkOptimizer {
    return this.networkOptimizer;
  }

  /**
   * 优化操作
   */
  optimizeOperations(operations: any[]): any[] {
    // 应用延迟优化
    const latencyOptimized = this.latencyOptimizer.optimizeOperations(operations);
    
    // 应用内存优化
    this.memoryOptimizer.addOperations(latencyOptimized);
    
    return latencyOptimized;
  }

  /**
   * 发送网络操作
   */
  async sendNetworkOperations(
    connectionId: string,
    operations: any[],
    sendFunction: (ops: any[]) => Promise<boolean>
  ): Promise<boolean> {
    return this.networkOptimizer.sendOperations(connectionId, operations, sendFunction);
  }

  /**
   * 接收网络操作
   */
  receiveNetworkOperations(
    connectionId: string,
    operations: any[]
  ): any[] {
    return this.networkOptimizer.receiveOperations(connectionId, operations);
  }

  /**
   * 设置性能监控
   */
  private setupMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.monitoringTimer = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.monitoringInterval);
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(): void {
    const latencyStats = this.latencyOptimizer.getLatencyStats();
    const memoryStats = this.memoryOptimizer.getMemoryStats();
    const networkStats = this.networkOptimizer.getNetworkStats();

    this.currentMetrics = {
      latency: latencyStats,
      memory: memoryStats,
      network: networkStats,
      overallScore: this.calculateOverallScore(latencyStats, memoryStats, networkStats),
      optimizationSuggestions: this.generateOptimizationSuggestions(latencyStats, memoryStats, networkStats)
    };

    this.eventEmitter.fire({
      type: 'metrics-update',
      data: this.currentMetrics
    });

    // 检查性能警报
    this.checkPerformanceAlerts();

    // 自动优化
    if (this.config.enableAutoOptimization) {
      this.applyAutoOptimization();
    }
  }

  /**
   * 计算总体性能分数
   */
  private calculateOverallScore(
    latency: LatencyStats,
    memory: MemoryStats,
    network: Map<string, NetworkStats>
  ): number {
    let score = 100; // 满分100

    // 延迟分数 (权重40%)
    const latencyScore = Math.max(0, 100 - (latency.averageLatency / this.config.performanceTargets.latency) * 100);
    score = score * 0.6 + latencyScore * 0.4;

    // 内存分数 (权重30%)
    const memoryScore = Math.max(0, 100 - (memory.memoryUsage / this.config.performanceTargets.memory) * 100);
    score = score * 0.7 + memoryScore * 0.3;

    // 网络分数 (权重30%)
    let networkScore = 100;
    if (network.size > 0) {
      let totalSuccess = 0;
      let connectionCount = 0;
      
      for (const stats of network.values()) {
        totalSuccess += stats.successRate;
        connectionCount++;
      }
      
      const avgSuccess = totalSuccess / connectionCount;
      networkScore = Math.max(0, (avgSuccess / this.config.performanceTargets.networkSuccess) * 100);
    }
    score = score * 0.7 + networkScore * 0.3;

    return Math.round(score);
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(
    latency: LatencyStats,
    memory: MemoryStats,
    network: Map<string, NetworkStats>
  ): string[] {
    const suggestions: string[] = [];

    // 延迟优化建议
    if (latency.averageLatency > this.config.performanceTargets.latency) {
      suggestions.push('延迟较高，建议启用操作批处理和压缩');
    }

    if (latency.maxLatency > this.config.performanceTargets.latency * 2) {
      suggestions.push('检测到峰值延迟，建议检查网络连接稳定性');
    }

    // 内存优化建议
    if (memory.memoryUsage > this.config.performanceTargets.memory) {
      suggestions.push('内存使用较高，建议启用垃圾回收和操作压缩');
    }

    if (memory.totalOperations > 1000) {
      suggestions.push('操作历史较大，建议清理旧的操作记录');
    }

    // 网络优化建议
    for (const [connectionId, stats] of network) {
      if (stats.successRate < this.config.performanceTargets.networkSuccess) {
        suggestions.push(`连接 ${connectionId} 成功率较低，建议检查网络状况`);
      }

      if (stats.retryCount > 10) {
        suggestions.push(`连接 ${connectionId} 重试次数较多，建议调整重试策略`);
      }
    }

    return suggestions;
  }

  /**
   * 检查性能警报
   */
  private checkPerformanceAlerts(): void {
    const score = this.currentMetrics.overallScore;

    if (score < this.config.alertThreshold) {
      this.eventEmitter.fire({
        type: 'alert-triggered',
        data: {
          score,
          threshold: this.config.alertThreshold,
          suggestions: this.currentMetrics.optimizationSuggestions
        }
      });
    }
  }

  /**
   * 应用自动优化
   */
  private applyAutoOptimization(): void {
    const { latency, memory } = this.currentMetrics;

    // 延迟自动优化
    if (latency.averageLatency > this.config.performanceTargets.latency) {
      this.latencyOptimizer.updateConfig({
        batchSize: Math.min(20, this.latencyOptimizer.getConfig().batchSize + 2),
        enableCompression: true
      });
    }

    // 内存自动优化
    if (memory.memoryUsage > this.config.performanceTargets.memory) {
      this.memoryOptimizer.updateConfig({
        maxOperationHistory: Math.max(500, this.memoryOptimizer.getConfig().maxOperationHistory - 100),
        garbageCollectionInterval: Math.max(15000, this.memoryOptimizer.getConfig().garbageCollectionInterval - 5000)
      });
    }

    // 网络自动优化
    const networkStats = this.currentMetrics.network;
    for (const [connectionId, stats] of networkStats) {
      if (stats.successRate < this.config.performanceTargets.networkSuccess) {
        this.networkOptimizer.updateConfig({
          maxRetryAttempts: Math.min(5, this.networkOptimizer.getConfig().maxRetryAttempts + 1),
          retryDelay: Math.max(50, this.networkOptimizer.getConfig().retryDelay - 25)
        });
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.monitoringInterval) {
      this.setupMonitoring();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * 重置性能监控
   */
  reset(): void {
    this.latencyOptimizer.resetStats();
    this.memoryOptimizer.clear();
    this.networkOptimizer.clear();
    
    this.currentMetrics = {
      latency: {
        averageLatency: 0,
        maxLatency: 0,
        minLatency: 0,
        operationCount: 0,
        optimizationRate: 0
      },
      memory: {
        totalOperations: 0,
        activeOperations: 0,
        memoryUsage: 0,
        garbageCollected: 0,
        optimizationRate: 0
      },
      network: new Map(),
      overallScore: 0,
      optimizationSuggestions: []
    };
  }

  /**
   * 销毁性能监控器
   */
  dispose(): void {
    this.stopMonitoring();
    this.latencyOptimizer.dispose();
    this.memoryOptimizer.dispose();
    this.networkOptimizer.dispose();
    this.eventEmitter.dispose();
  }
}