/**
 * 文件共享管理器模块
 * 实现基础文件共享机制
 */

import * as vscode from 'vscode';

export interface SharedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  sharedBy: string;
  sharedAt: number;
  permissions: FilePermissions;
  version: number;
  lastModified: number;
}

export interface FilePermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export interface ShareConfig {
  maxFileSize: number;
  allowedTypes: string[];
  enableVersioning: boolean;
  autoSyncInterval: number;
}

export class FileShareManager {
  private config: ShareConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['.js', '.ts', '.json', '.md', '.txt', '.css', '.html'],
    enableVersioning: true,
    autoSyncInterval: 30000 // 30秒
  };

  private sharedFiles: Map<string, SharedFile> = new Map();
  private fileVersions: Map<string, SharedFile[]> = new Map();

  private eventEmitter = new vscode.EventEmitter<{
    type: 'file-shared' | 'file-updated' | 'file-deleted' | 'permission-changed' | 'sync-complete';
    data: any;
  }>();

  public readonly onDidChange = this.eventEmitter.event;

  /**
   * 共享文件
   */
  async shareFile(
    filePath: string,
    sharedBy: string,
    permissions: Partial<FilePermissions> = {}
  ): Promise<SharedFile | null> {
    try {
      // 验证文件
      if (!(await this.validateFile(filePath))) {
        return null;
      }

      // 获取文件信息
      const fileInfo = await this.getFileInfo(filePath);
      if (!fileInfo) {
        return null;
      }

      const sharedFile: SharedFile = {
        id: this.generateFileId(),
        name: fileInfo.name,
        path: filePath,
        size: fileInfo.size,
        type: fileInfo.type,
        sharedBy,
        sharedAt: Date.now(),
        permissions: {
          canRead: true,
          canWrite: permissions.canWrite || false,
          canDelete: permissions.canDelete || false,
          canShare: permissions.canShare || false
        },
        version: 1,
        lastModified: fileInfo.lastModified
      };

      // 存储共享文件
      this.sharedFiles.set(sharedFile.id, sharedFile);

      // 存储版本历史
      if (this.config.enableVersioning) {
        this.fileVersions.set(sharedFile.id, [sharedFile]);
      }

      this.eventEmitter.fire({
        type: 'file-shared',
        data: sharedFile
      });

      return sharedFile;
    } catch (error) {
      console.error('共享文件失败:', error);
      return null;
    }
  }

  /**
   * 更新共享文件
   */
  async updateSharedFile(fileId: string, updatedBy: string): Promise<boolean> {
    const sharedFile = this.sharedFiles.get(fileId);
    if (!sharedFile) {
      return false;
    }

    try {
      // 获取最新文件信息
      const fileInfo = await this.getFileInfo(sharedFile.path);
      if (!fileInfo) {
        return false;
      }

      // 检查文件是否已修改
      if (fileInfo.lastModified <= sharedFile.lastModified) {
        return false; // 文件未修改
      }

      // 创建新版本
      const updatedFile: SharedFile = {
        ...sharedFile,
        size: fileInfo.size,
        version: sharedFile.version + 1,
        lastModified: fileInfo.lastModified
      };

      // 更新主存储
      this.sharedFiles.set(fileId, updatedFile);

      // 更新版本历史
      if (this.config.enableVersioning) {
        const versions = this.fileVersions.get(fileId) || [];
        versions.push(updatedFile);
        this.fileVersions.set(fileId, versions);
      }

      this.eventEmitter.fire({
        type: 'file-updated',
        data: {
          file: updatedFile,
          updatedBy
        }
      });

      return true;
    } catch (error) {
      console.error('更新共享文件失败:', error);
      return false;
    }
  }

  /**
   * 删除共享文件
   */
  deleteSharedFile(fileId: string, deletedBy: string): boolean {
    const sharedFile = this.sharedFiles.get(fileId);
    if (!sharedFile) {
      return false;
    }

    // 从主存储中移除
    this.sharedFiles.delete(fileId);

    // 从版本历史中移除
    if (this.config.enableVersioning) {
      this.fileVersions.delete(fileId);
    }

    this.eventEmitter.fire({
      type: 'file-deleted',
      data: {
        file: sharedFile,
        deletedBy
      }
    });

    return true;
  }

  /**
   * 获取共享文件内容
   */
  async getSharedFileContent(fileId: string): Promise<string | null> {
    const sharedFile = this.sharedFiles.get(fileId);
    if (!sharedFile) {
      return null;
    }

    try {
      const document = await vscode.workspace.openTextDocument(sharedFile.path);
      return document.getText();
    } catch (error) {
      console.error('读取共享文件内容失败:', error);
      return null;
    }
  }

  /**
   * 获取所有共享文件
   */
  getAllSharedFiles(): SharedFile[] {
    return Array.from(this.sharedFiles.values());
  }

  /**
   * 获取用户共享的文件
   */
  getFilesSharedByUser(userId: string): SharedFile[] {
    return Array.from(this.sharedFiles.values()).filter(
      file => file.sharedBy === userId
    );
  }

  /**
   * 获取文件版本历史
   */
  getFileVersions(fileId: string): SharedFile[] {
    return this.fileVersions.get(fileId) || [];
  }

  /**
   * 更新文件权限
   */
  updateFilePermissions(
    fileId: string,
    permissions: Partial<FilePermissions>,
    updatedBy: string
  ): boolean {
    const sharedFile = this.sharedFiles.get(fileId);
    if (!sharedFile) {
      return false;
    }

    const updatedFile: SharedFile = {
      ...sharedFile,
      permissions: {
        ...sharedFile.permissions,
        ...permissions
      }
    };

    this.sharedFiles.set(fileId, updatedFile);

    this.eventEmitter.fire({
      type: 'permission-changed',
      data: {
        file: updatedFile,
        updatedBy
      }
    });

    return true;
  }

  /**
   * 同步所有共享文件
   */
  async syncAllFiles(updatedBy: string): Promise<number> {
    let updatedCount = 0;

    for (const fileId of this.sharedFiles.keys()) {
      if (await this.updateSharedFile(fileId, updatedBy)) {
        updatedCount++;
      }
    }

    this.eventEmitter.fire({
      type: 'sync-complete',
      data: {
        updatedCount,
        totalFiles: this.sharedFiles.size,
        updatedBy,
        timestamp: Date.now()
      }
    });

    return updatedCount;
  }

  /**
   * 获取文件共享统计信息
   */
  getShareStats(): {
    totalFiles: number;
    totalSize: number;
    averageFileSize: number;
    mostSharedType: string;
    activeUsers: number;
  } {
    const files = this.getAllSharedFiles();
    
    if (files.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        averageFileSize: 0,
        mostSharedType: 'none',
        activeUsers: 0
      };
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const averageSize = totalSize / files.length;

    // 统计文件类型
    const typeCounts = new Map<string, number>();
    for (const file of files) {
      const count = typeCounts.get(file.type) || 0;
      typeCounts.set(file.type, count + 1);
    }

    let mostSharedType = 'none';
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) {
        mostSharedType = type;
        maxCount = count;
      }
    }

    // 统计活跃用户
    const users = new Set(files.map(file => file.sharedBy));

    return {
      totalFiles: files.length,
      totalSize,
      averageFileSize: averageSize,
      mostSharedType,
      activeUsers: users.size
    };
  }

  /**
   * 验证文件
   */
  private async validateFile(filePath: string): Promise<boolean> {
    try {
      // 检查文件是否存在
      const fileUri = vscode.Uri.file(filePath);
      const stat = await vscode.workspace.fs.stat(fileUri);

      // 检查文件大小
      if (stat.size > this.config.maxFileSize) {
        return false;
      }

      // 检查文件类型
      const fileExt = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
      if (!this.config.allowedTypes.includes(fileExt)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  private async getFileInfo(filePath: string): Promise<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  } | null> {
    try {
      const fileUri = vscode.Uri.file(filePath);
      const stat = await vscode.workspace.fs.stat(fileUri);

      return {
        name: filePath.split('/').pop() || filePath,
        size: stat.size,
        type: filePath.substring(filePath.lastIndexOf('.')).toLowerCase(),
        lastModified: stat.mtime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 生成文件ID
   */
  private generateFileId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ShareConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ShareConfig {
    return { ...this.config };
  }

  /**
   * 导出共享文件数据
   */
  exportSharedFiles(): SharedFile[] {
    return this.getAllSharedFiles();
  }

  /**
   * 导入共享文件数据
   */
  importSharedFiles(files: SharedFile[]): number {
    let importedCount = 0;

    for (const file of files) {
      if (!this.sharedFiles.has(file.id)) {
        this.sharedFiles.set(file.id, file);
        importedCount++;
      }
    }

    return importedCount;
  }

  /**
   * 清理文件共享管理器
   */
  clear(): void {
    this.sharedFiles.clear();
    this.fileVersions.clear();
  }

  /**
   * 销毁文件共享管理器
   */
  dispose(): void {
    this.eventEmitter.dispose();
    this.clear();
  }
}