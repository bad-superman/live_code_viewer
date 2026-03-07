import * as vscode from 'vscode';

export interface PerformanceMetrics {
  memoryUsage: number; // MB
  connectionLatency: number; // ms
  activeConnections: number;
  messageRate: number; // messages per second
  cpuUsage?: number; // percentage
  lastUpdate: number;
}

export class PerformancePanel {
  private panel: vscode.WebviewPanel | undefined;
  private metrics: PerformanceMetrics = {
    memoryUsage: 0,
    connectionLatency: 0,
    activeConnections: 0,
    messageRate: 0,
    lastUpdate: Date.now()
  };
  
  private updateInterval: NodeJS.Timeout | undefined;
  private readonly updateFrequency = 2000; // 2秒更新一次

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * 显示性能监控面板
   */
  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'performancePanel',
      'Live Code Viewer - Performance Monitor',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.updatePanelContent();
    this.startMetricsUpdate();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.stopMetricsUpdate();
    });
  }

  /**
   * 更新性能指标
   */
  updateMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...metrics,
      lastUpdate: Date.now()
    };

    if (this.panel) {
      this.updatePanelContent();
    }
  }

  /**
   * 开始指标更新
   */
  private startMetricsUpdate(): void {
    this.updateInterval = setInterval(() => {
      // 收集系统性能数据
      this.collectSystemMetrics();
      
      if (this.panel) {
        this.updatePanelContent();
      }
    }, this.updateFrequency);
  }

  /**
   * 停止指标更新
   */
  private stopMetricsUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * 收集系统性能指标
   */
  private collectSystemMetrics(): void {
    // 内存使用（估算）
    if (typeof process !== 'undefined') {
      this.metrics.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }

    // 这里可以添加更多系统性能指标的收集
    // 例如：连接延迟、消息速率等
  }

  /**
   * 更新面板内容
   */
  private updatePanelContent(): void {
    if (!this.panel) return;

    const metrics = this.metrics;
    const healthStatus = this.getHealthStatus();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: var(--vscode-font-family); 
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
          }
          .header { 
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .health-status {
            display: flex;
            align-items: center;
            padding: 10px 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            background: var(--vscode-input-background);
          }
          .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 10px;
          }
          .status-healthy { background: #4CAF50; }
          .status-warning { background: #FFC107; }
          .status-critical { background: #F44336; }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
          }
          .metric-card {
            background: var(--vscode-input-background);
            border-radius: 6px;
            padding: 15px;
            text-align: center;
            border-left: 4px solid var(--vscode-input-border);
          }
          .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .metric-label {
            font-size: 12px;
            opacity: 0.8;
            text-transform: uppercase;
          }
          .metric-unit {
            font-size: 12px;
            opacity: 0.6;
          }
          .recommendations {
            background: var(--vscode-input-background);
            border-radius: 6px;
            padding: 15px;
          }
          .recommendation-item {
            padding: 5px 0;
            display: flex;
            align-items: center;
          }
          .recommendation-icon {
            margin-right: 8px;
            font-size: 14px;
          }
          .chart-container {
            margin-top: 20px;
            background: var(--vscode-input-background);
            border-radius: 6px;
            padding: 15px;
          }
          .last-update {
            text-align: center;
            font-size: 12px;
            opacity: 0.6;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Live Code Viewer - Performance Monitor</h1>
          <p>实时性能指标和系统健康状态</p>
        </div>
        
        <div class="health-status">
          <div class="status-indicator ${healthStatus.statusClass}"></div>
          <div>
            <strong>系统健康状态: ${healthStatus.status}</strong>
            <div style="font-size: 12px; opacity: 0.8;">${healthStatus.message}</div>
          </div>
        </div>
        
        <div class="metrics-grid">
          <div class="metric-card" style="border-left-color: ${this.getMetricColor('memory', metrics.memoryUsage)};">
            <div class="metric-value">${metrics.memoryUsage}</div>
            <div class="metric-label">内存使用</div>
            <div class="metric-unit">MB</div>
          </div>
          
          <div class="metric-card" style="border-left-color: ${this.getMetricColor('latency', metrics.connectionLatency)};">
            <div class="metric-value">${metrics.connectionLatency}</div>
            <div class="metric-label">连接延迟</div>
            <div class="metric-unit">ms</div>
          </div>
          
          <div class="metric-card" style="border-left-color: ${this.getMetricColor('connections', metrics.activeConnections)};">
            <div class="metric-value">${metrics.activeConnections}</div>
            <div class="metric-label">活动连接</div>
            <div class="metric-unit">个</div>
          </div>
          
          <div class="metric-card" style="border-left-color: ${this.getMetricColor('messageRate', metrics.messageRate)};">
            <div class="metric-value">${metrics.messageRate}</div>
            <div class="metric-label">消息速率</div>
            <div class="metric-unit">msg/s</div>
          </div>
        </div>
        
        <div class="recommendations">
          <h3>优化建议</h3>
          ${this.generateRecommendations()}
        </div>
        
        <div class="chart-container">
          <h3>性能趋势</h3>
          <div style="text-align: center; padding: 40px; opacity: 0.6;">
            实时性能图表功能开发中...
          </div>
        </div>
        
        <div class="last-update">
          最后更新: ${new Date(metrics.lastUpdate).toLocaleTimeString()}
        </div>
        
        <script>
          // 自动刷新页面内容
          setInterval(() => {
            // 这里可以添加实时数据更新的逻辑
          }, 2000);
        </script>
      </body>
      </html>
    `;

    this.panel.webview.html = html;
  }

  /**
   * 获取健康状态
   */
  private getHealthStatus(): {
    status: string;
    statusClass: string;
    message: string;
  } {
    const { memoryUsage, connectionLatency, activeConnections } = this.metrics;

    if (memoryUsage > 100 || connectionLatency > 1000) {
      return {
        status: '严重',
        statusClass: 'status-critical',
        message: '系统资源使用过高，建议优化或重启扩展'
      };
    } else if (memoryUsage > 50 || connectionLatency > 500) {
      return {
        status: '警告',
        statusClass: 'status-warning',
        message: '系统资源使用较高，建议关注性能表现'
      };
    } else {
      return {
        status: '健康',
        statusClass: 'status-healthy',
        message: '系统运行正常，性能表现良好'
      };
    }
  }

  /**
   * 获取指标颜色
   */
  private getMetricColor(type: string, value: number): string {
    const thresholds = {
      memory: { good: 30, warning: 50, critical: 100 },
      latency: { good: 100, warning: 300, critical: 1000 },
      connections: { good: 5, warning: 10, critical: 20 },
      messageRate: { good: 10, warning: 50, critical: 100 }
    };

    const threshold = thresholds[type as keyof typeof thresholds];
    
    if (value <= threshold.good) return '#4CAF50'; // 绿色
    if (value <= threshold.warning) return '#FFC107'; // 黄色
    return '#F44336'; // 红色
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string {
    const { memoryUsage, connectionLatency, activeConnections } = this.metrics;
    const recommendations: string[] = [];

    if (memoryUsage > 50) {
      recommendations.push('内存使用较高，建议关闭不必要的功能或重启扩展');
    }

    if (connectionLatency > 300) {
      recommendations.push('连接延迟较高，建议检查网络状况或优化连接设置');
    }

    if (activeConnections > 10) {
      recommendations.push('活动连接数较多，可能影响性能，建议适当限制');
    }

    if (recommendations.length === 0) {
      recommendations.push('当前系统运行良好，无需特殊优化');
    }

    return recommendations
      .map(rec => `<div class="recommendation-item"><span class="recommendation-icon">💡</span>${rec}</div>`)
      .join('');
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    metrics: PerformanceMetrics;
    healthStatus: string;
    recommendations: string[];
  } {
    const healthStatus = this.getHealthStatus();
    
    return {
      metrics: this.metrics,
      healthStatus: healthStatus.status,
      recommendations: this.generateRecommendations()
        .replace(/<[^>]*>/g, '')
        .split('\n')
        .filter(rec => rec.trim())
    };
  }

  dispose(): void {
    this.stopMetricsUpdate();
    if (this.panel) {
      this.panel.dispose();
    }
  }
}