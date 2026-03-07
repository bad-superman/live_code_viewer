import * as vscode from 'vscode';

export enum ErrorCategory {
  NETWORK = 'network',
  PERMISSION = 'permission',
  CONNECTION = 'connection',
  ROOM = 'room',
  FILE = 'file',
  UNKNOWN = 'unknown'
}

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  stack?: string;
}

export class ErrorHandler {
  private errorHistory: ErrorInfo[] = [];
  private readonly maxErrorHistory = 50;
  private statusBarItem: vscode.StatusBarItem;

  constructor(private context: vscode.ExtensionContext) {
    // 创建错误状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      90
    );
    this.statusBarItem.text = "🔴 Error";
    this.statusBarItem.tooltip = "Live Code Viewer - Error Status";
    this.statusBarItem.hide();
    
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * 处理错误
   */
  handleError(
    error: Error | string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context?: Record<string, any>
  ): void {
    const errorInfo: ErrorInfo = {
      category,
      message: error instanceof Error ? error.message : error,
      timestamp: Date.now(),
      context,
      stack: error instanceof Error ? error.stack : undefined
    };

    // 添加到错误历史
    this.errorHistory.unshift(errorInfo);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.pop();
    }

    // 显示错误状态
    this.updateErrorStatus(errorInfo);

    // 记录到控制台
    console.error(`[Live Code Viewer] ${category.toUpperCase()} Error:`, errorInfo.message, context);

    // 根据错误类别显示用户提示
    this.showUserNotification(errorInfo);
  }

  /**
   * 更新错误状态显示
   */
  private updateErrorStatus(errorInfo: ErrorInfo): void {
    // 根据错误严重程度设置状态栏
    const isCritical = this.isCriticalError(errorInfo);
    
    if (isCritical) {
      this.statusBarItem.text = "🔴 Critical Error";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = "🟡 Warning";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.show();
    }

    // 5秒后隐藏非关键错误
    if (!isCritical) {
      setTimeout(() => {
        this.statusBarItem.hide();
      }, 5000);
    }
  }

  /**
   * 判断是否为关键错误
   */
  private isCriticalError(errorInfo: ErrorInfo): boolean {
    const criticalPatterns = [
      'connection lost',
      'failed to connect',
      'network error',
      'permission denied',
      'room not found'
    ];

    return criticalPatterns.some(pattern => 
      errorInfo.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * 显示用户通知
   */
  private showUserNotification(errorInfo: ErrorInfo): void {
    let message: string;
    let severity: 'info' | 'warning' | 'error';

    switch (errorInfo.category) {
      case ErrorCategory.NETWORK:
        message = `网络连接问题: ${errorInfo.message}`;
        severity = 'warning';
        break;
      case ErrorCategory.CONNECTION:
        message = `连接错误: ${errorInfo.message}`;
        severity = 'error';
        break;
      case ErrorCategory.PERMISSION:
        message = `权限错误: ${errorInfo.message}`;
        severity = 'warning';
        break;
      case ErrorCategory.ROOM:
        message = `房间错误: ${errorInfo.message}`;
        severity = 'warning';
        break;
      case ErrorCategory.FILE:
        message = `文件错误: ${errorInfo.message}`;
        severity = 'warning';
        break;
      default:
        message = `未知错误: ${errorInfo.message}`;
        severity = 'error';
    }

    // 添加解决方案建议
    const solution = this.getSolutionSuggestion(errorInfo);
    if (solution) {
      message += `\n建议: ${solution}`;
    }

    // 显示通知
    if (severity === 'error') {
      vscode.window.showErrorMessage(message);
    } else if (severity === 'warning') {
      vscode.window.showWarningMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  /**
   * 获取解决方案建议
   */
  private getSolutionSuggestion(errorInfo: ErrorInfo): string | null {
    switch (errorInfo.category) {
      case ErrorCategory.NETWORK:
        return '请检查网络连接，或稍后重试';
      case ErrorCategory.CONNECTION:
        return '尝试重新连接，或检查目标主机状态';
      case ErrorCategory.PERMISSION:
        return '请联系房间管理员获取访问权限';
      case ErrorCategory.ROOM:
        return '房间可能已关闭，请尝试创建新房间';
      case ErrorCategory.FILE:
        return '文件可能已被删除或移动，请检查文件路径';
      default:
        return null;
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    recentErrors: number; // 最近1小时的错误
  } {
    const oneHourAgo = Date.now() - 3600000;
    
    const stats = {
      total: this.errorHistory.length,
      byCategory: {
        [ErrorCategory.NETWORK]: 0,
        [ErrorCategory.PERMISSION]: 0,
        [ErrorCategory.CONNECTION]: 0,
        [ErrorCategory.ROOM]: 0,
        [ErrorCategory.FILE]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      recentErrors: 0
    };

    this.errorHistory.forEach(error => {
      stats.byCategory[error.category]++;
      if (error.timestamp > oneHourAgo) {
        stats.recentErrors++;
      }
    });

    return stats;
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.statusBarItem.hide();
  }

  /**
   * 显示错误报告
   */
  showErrorReport(): void {
    const stats = this.getErrorStats();
    const recentErrors = this.errorHistory
      .filter(error => error.timestamp > Date.now() - 3600000)
      .slice(0, 10);

    const panel = vscode.window.createWebviewPanel(
      'errorReport',
      'Live Code Viewer - Error Report',
      vscode.ViewColumn.One,
      {}
    );

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: var(--vscode-font-family); 
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          .header { 
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .stat-item {
            text-align: center;
            padding: 15px;
            border-radius: 5px;
            background: var(--vscode-input-background);
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
          }
          .stat-label {
            font-size: 12px;
            opacity: 0.8;
          }
          .error-list {
            display: grid;
            gap: 10px;
          }
          .error-item {
            padding: 15px;
            border-radius: 5px;
            background: var(--vscode-input-background);
            border-left: 4px solid var(--vscode-inputValidation-errorBorder);
          }
          .error-category {
            font-weight: bold;
            color: var(--vscode-inputValidation-errorBorder);
          }
          .error-message {
            margin: 5px 0;
          }
          .error-time {
            font-size: 12px;
            opacity: 0.6;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Live Code Viewer - Error Report</h1>
          <p>错误统计和最近错误记录</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Errors</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.recentErrors}</div>
            <div class="stat-label">Recent (1h)</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.round((stats.total - stats.recentErrors) / stats.total * 100)}%</div>
            <div class="stat-label">Stability</div>
          </div>
        </div>
        
        <h3>Recent Errors</h3>
        <div class="error-list">
    `;

    if (recentErrors.length === 0) {
      html += `
        <div style="text-align: center; padding: 40px; opacity: 0.6;">
          No recent errors
        </div>
      `;
    } else {
      recentErrors.forEach(error => {
        const time = new Date(error.timestamp).toLocaleTimeString();
        html += `
          <div class="error-item">
            <div class="error-category">${error.category.toUpperCase()}</div>
            <div class="error-message">${error.message}</div>
            <div class="error-time">${time}</div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </body>
      </html>
    `;

    panel.webview.html = html;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}