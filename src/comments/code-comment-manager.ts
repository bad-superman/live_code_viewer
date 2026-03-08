/**
 * 代码评论管理器模块
 * 实现基础代码评论功能
 */

import * as vscode from 'vscode';

export interface CodeComment {
  id: string;
  documentUri: string;
  line: number;
  character: number;
  content: string;
  author: string;
  timestamp: number;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  content: string;
  author: string;
  timestamp: number;
}

export interface CommentConfig {
  enableNotifications: boolean;
  maxCommentLength: number;
  allowReplies: boolean;
  autoResolveThreshold: number;
}

export class CodeCommentManager {
  private config: CommentConfig = {
    enableNotifications: true,
    maxCommentLength: 1000,
    allowReplies: true,
    autoResolveThreshold: 7 * 24 * 60 * 60 * 1000 // 7天
  };

  private comments: Map<string, CodeComment> = new Map();
  private documentComments: Map<string, Set<string>> = new Map();

  private eventEmitter = new vscode.EventEmitter<{
    type: 'comment-added' | 'comment-resolved' | 'reply-added' | 'notification';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  /**
   * 添加代码评论
   */
  addComment(
    documentUri: string,
    line: number,
    character: number,
    content: string,
    author: string
  ): CodeComment | null {
    // 验证评论内容
    if (!this.validateComment(content)) {
      return null;
    }

    const comment: CodeComment = {
      id: this.generateCommentId(),
      documentUri,
      line,
      character,
      content: content.trim(),
      author,
      timestamp: Date.now(),
      resolved: false,
      replies: []
    };

    // 存储评论
    this.comments.set(comment.id, comment);

    // 更新文档评论索引
    const docComments = this.documentComments.get(documentUri) || new Set();
    docComments.add(comment.id);
    this.documentComments.set(documentUri, docComments);

    // 触发事件
    this.eventEmitter.fire({
      type: 'comment-added',
      data: comment
    });

    // 发送通知
    if (this.config.enableNotifications) {
      this.showNotification(`新评论添加在行 ${line + 1}`, content);
    }

    return comment;
  }

  /**
   * 解析评论
   */
  resolveComment(commentId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment || comment.resolved) {
      return false;
    }

    comment.resolved = true;

    this.eventEmitter.fire({
      type: 'comment-resolved',
      data: comment
    });

    return true;
  }

  /**
   * 取消解析评论
   */
  unresolveComment(commentId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment || !comment.resolved) {
      return false;
    }

    comment.resolved = false;

    this.eventEmitter.fire({
      type: 'comment-resolved',
      data: comment
    });

    return true;
  }

  /**
   * 添加评论回复
   */
  addReply(commentId: string, content: string, author: string): CommentReply | null {
    if (!this.config.allowReplies) {
      return null;
    }

    const comment = this.comments.get(commentId);
    if (!comment || comment.resolved) {
      return null;
    }

    // 验证回复内容
    if (!this.validateComment(content)) {
      return null;
    }

    const reply: CommentReply = {
      id: this.generateReplyId(),
      content: content.trim(),
      author,
      timestamp: Date.now()
    };

    comment.replies.push(reply);

    this.eventEmitter.fire({
      type: 'reply-added',
      data: {
        comment,
        reply
      }
    });

    // 发送通知
    if (this.config.enableNotifications) {
      this.showNotification(`新回复: ${author}`, content);
    }

    return reply;
  }

  /**
   * 获取文档的所有评论
   */
  getCommentsForDocument(documentUri: string): CodeComment[] {
    const commentIds = this.documentComments.get(documentUri);
    if (!commentIds) {
      return [];
    }

    const comments: CodeComment[] = [];
    for (const commentId of commentIds) {
      const comment = this.comments.get(commentId);
      if (comment) {
        comments.push(comment);
      }
    }

    return comments.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取特定行的评论
   */
  getCommentsForLine(documentUri: string, line: number): CodeComment[] {
    const allComments = this.getCommentsForDocument(documentUri);
    return allComments.filter(comment => comment.line === line);
  }

  /**
   * 获取所有未解析的评论
   */
  getUnresolvedComments(): CodeComment[] {
    const unresolved: CodeComment[] = [];
    
    for (const comment of this.comments.values()) {
      if (!comment.resolved) {
        unresolved.push(comment);
      }
    }

    return unresolved.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取评论统计信息
   */
  getCommentStats(): {
    totalComments: number;
    unresolvedComments: number;
    totalReplies: number;
    averageRepliesPerComment: number;
  } {
    let totalReplies = 0;
    let unresolvedCount = 0;

    for (const comment of this.comments.values()) {
      totalReplies += comment.replies.length;
      if (!comment.resolved) {
        unresolvedCount++;
      }
    }

    const totalComments = this.comments.size;
    const averageReplies = totalComments > 0 ? totalReplies / totalComments : 0;

    return {
      totalComments,
      unresolvedComments: unresolvedCount,
      totalReplies,
      averageRepliesPerComment: averageReplies
    };
  }

  /**
   * 自动解析旧评论
   */
  autoResolveOldComments(): number {
    const now = Date.now();
    const cutoffTime = now - this.config.autoResolveThreshold;
    let resolvedCount = 0;

    for (const comment of this.comments.values()) {
      if (!comment.resolved && comment.timestamp < cutoffTime) {
        comment.resolved = true;
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      this.eventEmitter.fire({
        type: 'comment-resolved',
        data: { resolvedCount, timestamp: now }
      });
    }

    return resolvedCount;
  }

  /**
   * 删除评论
   */
  deleteComment(commentId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment) {
      return false;
    }

    // 从文档索引中移除
    const docComments = this.documentComments.get(comment.documentUri);
    if (docComments) {
      docComments.delete(commentId);
    }

    // 从主存储中移除
    this.comments.delete(commentId);

    return true;
  }

  /**
   * 删除文档的所有评论
   */
  deleteCommentsForDocument(documentUri: string): number {
    const commentIds = this.documentComments.get(documentUri);
    if (!commentIds) {
      return 0;
    }

    let deletedCount = 0;
    for (const commentId of commentIds) {
      if (this.comments.delete(commentId)) {
        deletedCount++;
      }
    }

    this.documentComments.delete(documentUri);

    return deletedCount;
  }

  /**
   * 验证评论内容
   */
  private validateComment(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }

    if (content.length > this.config.maxCommentLength) {
      return false;
    }

    return true;
  }

  /**
   * 生成评论ID
   */
  private generateCommentId(): string {
    return `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成回复ID
   */
  private generateReplyId(): string {
    return `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 显示通知
   */
  private showNotification(title: string, content: string): void {
    if (this.config.enableNotifications) {
      vscode.window.showInformationMessage(`${title}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CommentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): CommentConfig {
    return { ...this.config };
  }

  /**
   * 导出评论数据
   */
  exportComments(): CodeComment[] {
    return Array.from(this.comments.values());
  }

  /**
   * 导入评论数据
   */
  importComments(comments: CodeComment[]): number {
    let importedCount = 0;

    for (const comment of comments) {
      if (!this.comments.has(comment.id)) {
        this.comments.set(comment.id, comment);

        // 更新文档索引
        const docComments = this.documentComments.get(comment.documentUri) || new Set();
        docComments.add(comment.id);
        this.documentComments.set(comment.documentUri, docComments);

        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * 清理评论管理器
   */
  clear(): void {
    this.comments.clear();
    this.documentComments.clear();
  }

  /**
   * 销毁评论管理器
   */
  dispose(): void {
    this.eventEmitter.dispose();
    this.clear();
  }
}