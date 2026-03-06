import * as vscode from 'vscode';

export interface ShortcutConfig {
  command: string;
  key: string;
  description: string;
  category: string;
}

export class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeDefaultShortcuts();
  }

  /**
   * 初始化默认快捷键
   */
  private initializeDefaultShortcuts(): void {
    const defaultShortcuts: ShortcutConfig[] = [
      {
        command: 'live-code-viewer.startHosting',
        key: 'ctrl+alt+l ctrl+alt+h',
        description: '开始直播',
        category: '直播控制'
      },
      {
        command: 'live-code-viewer.stopHosting',
        key: 'ctrl+alt+l ctrl+alt+s',
        description: '停止直播',
        category: '直播控制'
      },
      {
        command: 'live-code-viewer.connectToHost',
        key: 'ctrl+alt+l ctrl+alt+c',
        description: '连接主播',
        category: '观看控制'
      },
      {
        command: 'live-code-viewer.disconnect',
        key: 'ctrl+alt+l ctrl+alt+d',
        description: '断开连接',
        category: '观看控制'
      },
      {
        command: 'live-code-viewer.createRoom',
        key: 'ctrl+alt+l ctrl+alt+r',
        description: '创建房间',
        category: '房间管理'
      },
      {
        command: 'live-code-viewer.showRoomPanel',
        key: 'ctrl+alt+l ctrl+alt+p',
        description: '显示房间面板',
        category: '房间管理'
      }
    ];

    defaultShortcuts.forEach(shortcut => {
      this.shortcuts.set(shortcut.command, shortcut);
    });
  }

  /**
   * 注册所有快捷键
   */
  registerShortcuts(): void {
    this.shortcuts.forEach((shortcut, command) => {
      const disposable = vscode.commands.registerCommand(command, () => {
        this.executeCommand(command);
      });
      this.context.subscriptions.push(disposable);
    });
  }

  /**
   * 执行命令
   */
  private async executeCommand(command: string): Promise<void> {
    try {
      await vscode.commands.executeCommand(command);
    } catch (error) {
      console.error(`执行命令失败: ${command}`, error);
      vscode.window.showErrorMessage(`执行命令失败: ${command}`);
    }
  }

  /**
   * 获取所有快捷键配置
   */
  getAllShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 按分类获取快捷键
   */
  getShortcutsByCategory(category: string): ShortcutConfig[] {
    return this.getAllShortcuts().filter(shortcut => shortcut.category === category);
  }

  /**
   * 添加自定义快捷键
   */
  addCustomShortcut(shortcut: ShortcutConfig): boolean {
    if (this.shortcuts.has(shortcut.command)) {
      return false; // 命令已存在
    }

    this.shortcuts.set(shortcut.command, shortcut);
    
    // 注册新的快捷键
    const disposable = vscode.commands.registerCommand(shortcut.command, () => {
      this.executeCommand(shortcut.command);
    });
    this.context.subscriptions.push(disposable);

    return true;
  }

  /**
   * 移除快捷键
   */
  removeShortcut(command: string): boolean {
    return this.shortcuts.delete(command);
  }

  /**
   * 检查快捷键冲突
   */
  checkKeyConflicts(key: string): string[] {
    const conflicts: string[] = [];
    
    this.shortcuts.forEach((shortcut, command) => {
      if (shortcut.key === key) {
        conflicts.push(`${shortcut.description} (${command})`);
      }
    });

    return conflicts;
  }

  /**
   * 导出快捷键配置
   */
  exportConfig(): Record<string, ShortcutConfig> {
    const config: Record<string, ShortcutConfig> = {};
    this.shortcuts.forEach((shortcut, command) => {
      config[command] = shortcut;
    });
    return config;
  }

  /**
   * 导入快捷键配置
   */
  importConfig(config: Record<string, ShortcutConfig>): void {
    Object.entries(config).forEach(([command, shortcut]) => {
      this.shortcuts.set(command, shortcut);
    });
  }

  /**
   * 显示快捷键帮助
   */
  showHelp(): void {
    const categories = new Set(this.getAllShortcuts().map(s => s.category));
    
    let helpText = '## Live Code Viewer 快捷键帮助\n\n';
    
    categories.forEach(category => {
      helpText += `### ${category}\n`;
      const categoryShortcuts = this.getShortcutsByCategory(category);
      
      categoryShortcuts.forEach(shortcut => {
        helpText += `- **${shortcut.key}**: ${shortcut.description}\n`;
      });
      
      helpText += '\n';
    });

    const panel = vscode.window.createWebviewPanel(
      'shortcutHelp',
      'Live Code Viewer 快捷键帮助',
      vscode.ViewColumn.One,
      {}
    );

    panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          h1 { color: var(--vscode-foreground); }
          h3 { color: var(--vscode-foreground); margin-top: 20px; }
          ul { list-style-type: none; padding-left: 0; }
          li { margin: 8px 0; }
          .key { background: var(--vscode-badge-background); 
                 color: var(--vscode-badge-foreground); 
                 padding: 2px 6px; 
                 border-radius: 3px; 
                 font-family: monospace; }
        </style>
      </head>
      <body>
        ${helpText.replace(/\n/g, '<br>')}
      </body>
      </html>
    `;
  }

  dispose(): void {
    // VS Code 会自动处理注册的命令的销毁
  }
}