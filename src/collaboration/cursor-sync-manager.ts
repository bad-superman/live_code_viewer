import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';

export interface CursorPosition {
  participantId: string;
  fileName: string;
  line: number;
  column: number;
  timestamp: number;
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface ParticipantCursor {
  participantId: string;
  participantName: string;
  color: string;
  position: CursorPosition;
  isActive: boolean;
  lastActivity: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class CursorSyncManager {
  private cursors: Map<string, ParticipantCursor> = new Map();
  private cursorDecorations: Map<string, vscode.TextEditorDecorationType> = new Map();
  private readonly cursorUpdateEmitter = new EventEmitter<ParticipantCursor[]>();
  private cleanupInterval: NodeJS.Timeout | undefined;
  
  public onCursorUpdate = this.cursorUpdateEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.startCleanupInterval();
  }

  /**
   * 更新参与者光标位置
   */
  updateCursorPosition(participantId: string, participantName: string, position: CursorPosition, connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good'): void {
    const existingCursor = this.cursors.get(participantId);
    const color = this.getParticipantColor(participantId);
    
    const cursor: ParticipantCursor = {
      participantId,
      participantName,
      color,
      position,
      isActive: true,
      lastActivity: Date.now(),
      connectionQuality
    };

    this.cursors.set(participantId, cursor);
    this.updateCursorDisplay();
    this.cursorUpdateEmitter.fire(Array.from(this.cursors.values()));
  }

  /**
   * 移除参与者光标
   */
  removeCursor(participantId: string): void {
    this.cursors.delete(participantId);
    this.removeCursorDecoration(participantId);
    this.cursorUpdateEmitter.fire(Array.from(this.cursors.values()));
  }

  /**
   * 清除所有光标
   */
  clearAllCursors(): void {
    this.cursors.clear();
    this.cursorDecorations.forEach(decoration => decoration.dispose());
    this.cursorDecorations.clear();
    this.cursorUpdateEmitter.fire([]);
  }

  /**
   * 获取所有活动光标
   */
  getActiveCursors(): ParticipantCursor[] {
    return Array.from(this.cursors.values()).filter(cursor => cursor.isActive);
  }

  /**
   * 更新光标显示
   */
  private updateCursorDisplay(): void {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    this.cursors.forEach((cursor, participantId) => {
      this.updateCursorDecoration(activeEditor, cursor, participantId);
    });
  }

  /**
   * 更新光标装饰器
   */
  private updateCursorDecoration(editor: vscode.TextEditor, cursor: ParticipantCursor, participantId: string): void {
    // 移除旧的装饰器
    this.removeCursorDecoration(participantId);

    // 创建新的装饰器
    const decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: cursor.color + '20', // 20% 透明度
      border: `1px solid ${cursor.color}`,
      borderWidth: '1px',
      borderStyle: 'solid',
      after: {
        contentText: ` ${cursor.participantName} (${cursor.connectionQuality})`,
        color: cursor.color,
        fontWeight: 'bold'
      }
    });

    this.cursorDecorations.set(participantId, decorationType);

    // 设置装饰器位置
    const ranges: vscode.Range[] = [];
    
    // 光标位置
    const cursorPosition = new vscode.Position(cursor.position.line, cursor.position.column);
    ranges.push(new vscode.Range(cursorPosition, cursorPosition));
    
    // 选择区域（如果有）
    if (cursor.position.selection) {
      const selectionStart = new vscode.Position(
        cursor.position.selection.start.line,
        cursor.position.selection.start.column
      );
      const selectionEnd = new vscode.Position(
        cursor.position.selection.end.line,
        cursor.position.selection.end.column
      );
      ranges.push(new vscode.Range(selectionStart, selectionEnd));
    }

    editor.setDecorations(decorationType, ranges);
  }

  /**
   * 移除光标装饰器
   */
  private removeCursorDecoration(participantId: string): void {
    const decoration = this.cursorDecorations.get(participantId);
    if (decoration) {
      decoration.dispose();
      this.cursorDecorations.delete(participantId);
    }
  }

  /**
   * 获取参与者颜色（基于 ID 生成稳定颜色）
   */
  private getParticipantColor(participantId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    
    // 基于 participantId 生成稳定的颜色索引
    let hash = 0;
    for (let i = 0; i < participantId.length; i++) {
      hash = participantId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * 启动清理间隔，移除不活动的参与者
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveCursors();
    }, 30000); // 每30秒清理一次
  }

  /**
   * 清理不活动的光标
   */
  private cleanupInactiveCursors(): void {
    const now = Date.now();
    const inactiveThreshold = 60000; // 60秒不活动视为不活跃

    let hasChanges = false;
    
    this.cursors.forEach((cursor, participantId) => {
      if (now - cursor.lastActivity > inactiveThreshold) {
        this.cursors.delete(participantId);
        this.removeCursorDecoration(participantId);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.cursorUpdateEmitter.fire(Array.from(this.cursors.values()));
    }
  }

  /**
   * 获取连接质量统计
   */
  getConnectionStats(): {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    total: number;
  } {
    const stats = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      total: this.cursors.size
    };

    this.cursors.forEach(cursor => {
      stats[cursor.connectionQuality]++;
    });

    return stats;
  }

  dispose(): void {
    this.clearAllCursors();
    this.cursorUpdateEmitter.dispose();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}