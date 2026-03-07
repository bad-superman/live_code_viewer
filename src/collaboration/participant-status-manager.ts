import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';

export interface ParticipantStatus {
  participantId: string;
  participantName: string;
  isActive: boolean;
  lastActivity: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  currentFile?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
}

export class ParticipantStatusManager {
  private participants: Map<string, ParticipantStatus> = new Map();
  private readonly statusUpdateEmitter = new EventEmitter<ParticipantStatus[]>();
  private statusBarItem: vscode.StatusBarItem;
  private cleanupInterval: NodeJS.Timeout | undefined;
  
  public onStatusUpdate = this.statusUpdateEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    // 创建状态栏项
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.text = "👥 0 participants";
    this.statusBarItem.tooltip = "Live Code Viewer - Active Participants";
    this.statusBarItem.show();
    
    this.startCleanupInterval();
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * 更新参与者状态
   */
  updateParticipantStatus(
    participantId: string,
    participantName: string,
    connectionQuality: 'excellent' | 'good' | 'fair' | 'poor',
    currentFile?: string,
    cursorPosition?: { line: number; column: number }
  ): void {
    const existingStatus = this.participants.get(participantId);
    
    const status: ParticipantStatus = {
      participantId,
      participantName,
      isActive: true,
      lastActivity: Date.now(),
      connectionQuality,
      currentFile,
      cursorPosition
    };

    this.participants.set(participantId, status);
    this.updateStatusBar();
    this.statusUpdateEmitter.fire(Array.from(this.participants.values()));
  }

  /**
   * 移除参与者
   */
  removeParticipant(participantId: string): void {
    this.participants.delete(participantId);
    this.updateStatusBar();
    this.statusUpdateEmitter.fire(Array.from(this.participants.values()));
  }

  /**
   * 清除所有参与者
   */
  clearAllParticipants(): void {
    this.participants.clear();
    this.updateStatusBar();
    this.statusUpdateEmitter.fire([]);
  }

  /**
   * 获取所有活动参与者
   */
  getActiveParticipants(): ParticipantStatus[] {
    return Array.from(this.participants.values()).filter(status => status.isActive);
  }

  /**
   * 获取参与者统计
   */
  getParticipantStats(): {
    total: number;
    active: number;
    connectionQuality: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  } {
    const activeParticipants = this.getActiveParticipants();
    const stats = {
      total: this.participants.size,
      active: activeParticipants.length,
      connectionQuality: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      }
    };

    activeParticipants.forEach(participant => {
      stats.connectionQuality[participant.connectionQuality]++;
    });

    return stats;
  }

  /**
   * 更新状态栏显示
   */
  private updateStatusBar(): void {
    const stats = this.getParticipantStats();
    
    if (stats.active === 0) {
      this.statusBarItem.text = "👥 0 participants";
      this.statusBarItem.backgroundColor = undefined;
    } else {
      // 根据连接质量设置状态栏颜色
      let backgroundColor: vscode.ThemeColor | undefined;
      
      if (stats.connectionQuality.poor > 0) {
        backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      } else if (stats.connectionQuality.fair > 0) {
        backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }

      this.statusBarItem.text = `👥 ${stats.active} participants`;
      this.statusBarItem.backgroundColor = backgroundColor;
      
      // 更新工具提示
      let tooltip = `Live Code Viewer - Active Participants\n`;
      tooltip += `Total: ${stats.active}\n`;
      tooltip += `Excellent: ${stats.connectionQuality.excellent}\n`;
      tooltip += `Good: ${stats.connectionQuality.good}\n`;
      tooltip += `Fair: ${stats.connectionQuality.fair}\n`;
      tooltip += `Poor: ${stats.connectionQuality.poor}`;
      
      this.statusBarItem.tooltip = tooltip;
    }
  }

  /**
   * 启动清理间隔，移除不活动的参与者
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveParticipants();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 清理不活动的参与者
   */
  private cleanupInactiveParticipants(): void {
    const now = Date.now();
    const inactiveThreshold = 90000; // 90秒不活动视为不活跃

    let hasChanges = false;
    
    this.participants.forEach((status, participantId) => {
      if (now - status.lastActivity > inactiveThreshold) {
        this.participants.delete(participantId);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.updateStatusBar();
      this.statusUpdateEmitter.fire(Array.from(this.participants.values()));
    }
  }

  /**
   * 显示参与者面板
   */
  showParticipantPanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'participantPanel',
      'Live Code Viewer - Participants',
      vscode.ViewColumn.One,
      {}
    );

    this.updateParticipantPanel(panel);
    
    // 监听状态更新
    const disposable = this.onStatusUpdate(() => {
      this.updateParticipantPanel(panel);
    });

    panel.onDidDispose(() => {
      disposable.dispose();
    });
  }

  /**
   * 更新参与者面板内容
   */
  private updateParticipantPanel(panel: vscode.WebviewPanel): void {
    const participants = this.getActiveParticipants();
    const stats = this.getParticipantStats();

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
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .stat-item {
            text-align: center;
            padding: 10px;
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
          .participant-list {
            display: grid;
            gap: 10px;
          }
          .participant-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-radius: 5px;
            background: var(--vscode-input-background);
          }
          .participant-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-weight: bold;
            color: white;
          }
          .participant-info {
            flex: 1;
          }
          .participant-name {
            font-weight: bold;
          }
          .participant-details {
            font-size: 12px;
            opacity: 0.8;
          }
          .connection-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
          }
          .excellent { background: #4CAF50; }
          .good { background: #8BC34A; }
          .fair { background: #FFC107; }
          .poor { background: #F44336; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Live Code Viewer - Participants</h1>
          <p>Real-time participant status and connection quality</p>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.active}</div>
            <div class="stat-label">Active</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.connectionQuality.excellent}</div>
            <div class="stat-label">Excellent</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.connectionQuality.poor}</div>
            <div class="stat-label">Poor</div>
          </div>
        </div>
        
        <div class="participant-list">
    `;

    if (participants.length === 0) {
      html += `
        <div style="text-align: center; padding: 40px; opacity: 0.6;">
          No active participants
        </div>
      `;
    } else {
      participants.forEach(participant => {
        const avatarColor = this.getAvatarColor(participant.participantId);
        const initials = participant.participantName.substring(0, 2).toUpperCase();
        
        html += `
          <div class="participant-item">
            <div class="participant-avatar" style="background: ${avatarColor};">
              ${initials}
            </div>
            <div class="participant-info">
              <div class="participant-name">${participant.participantName}</div>
              <div class="participant-details">
                <span class="connection-indicator ${participant.connectionQuality}"></span>
                ${participant.connectionQuality.charAt(0).toUpperCase() + participant.connectionQuality.slice(1)} connection
                ${participant.currentFile ? ` • ${participant.currentFile}` : ''}
                ${participant.cursorPosition ? ` • Line ${participant.cursorPosition.line + 1}` : ''}
              </div>
            </div>
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

  /**
   * 获取头像颜色
   */
  private getAvatarColor(participantId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    let hash = 0;
    for (let i = 0; i < participantId.length; i++) {
      hash = participantId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  dispose(): void {
    this.clearAllParticipants();
    this.statusUpdateEmitter.dispose();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}