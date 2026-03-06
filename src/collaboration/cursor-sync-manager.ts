import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';

export interface CursorPosition {
  participantId: string;
  fileName: string;
  line: number;
  column: number;
  timestamp: number;
}

export interface ParticipantCursor {
  participantId: string;
  participantName: string;
  color: string;
  position: CursorPosition;
  isActive: boolean;
}

export class CursorSyncManager {
  private cursors: Map<string, ParticipantCursor> = new Map();
  private cursorDecorations: Map<string, vscode.TextEditorDecorationType> = new Map();
  private readonly cursorUpdateEmitter = new EventEmitter<ParticipantCursor[]>();
  
  public onCursorUpdate = this.cursorUpdateEmitter.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * 更新参与者光标位置
   */
  updateCursorPosition(participantId: string, participantName: string, position: CursorPosition): void {
    const existingCursor = this.cursors.get(participantId);
    const color = this.getParticipantColor(participantId);
    
    const cursor: ParticipantCursor = {
      participantId,
      participantName,
      color,
      position,
      isActive: true
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
        contentText: ` ${cursor.participantName}`,
        color: cursor.color,
        fontWeight: 'bold'
      }
    });

    this.cursorDecorations.set(participantId, decorationType);

    // 设置装饰器位置
    const position = new vscode.Position(cursor.position.line, cursor.position.column);
    const range = new vscode.Range(position, position);
    editor.setDecorations(decorationType, [range]);
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

  dispose(): void {
    this.clearAllCursors();
    this.cursorUpdateEmitter.dispose();
  }
}