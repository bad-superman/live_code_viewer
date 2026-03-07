import * as vscode from 'vscode';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  border: string;
  error: string;
  warning: string;
  success: string;
}

export class ThemeAdapter {
  private currentTheme: string = 'dark';
  private themeColors: Map<string, ThemeColors> = new Map();
  private readonly themeChangeEmitter = new vscode.EventEmitter<void>();
  
  public onThemeChange = this.themeChangeEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.initializeThemeColors();
    this.detectCurrentTheme();
    this.setupThemeListener();
  }

  /**
   * 初始化主题颜色配置
   */
  private initializeThemeColors(): void {
    // 浅色主题
    this.themeColors.set('light', {
      primary: '#1976D2',
      secondary: '#424242',
      accent: '#82B1FF',
      background: '#FFFFFF',
      foreground: '#212121',
      border: '#E0E0E0',
      error: '#D32F2F',
      warning: '#FFA000',
      success: '#388E3C'
    });

    // 深色主题
    this.themeColors.set('dark', {
      primary: '#90CAF9',
      secondary: '#B0BEC5',
      accent: '#448AFF',
      background: '#1E1E1E',
      foreground: '#E0E0E0',
      border: '#424242',
      error: '#F44336',
      warning: '#FFB74D',
      success: '#81C784'
    });

    // 高对比度主题
    this.themeColors.set('hc', {
      primary: '#FFFF00',
      secondary: '#FFFFFF',
      accent: '#00FFFF',
      background: '#000000',
      foreground: '#FFFFFF',
      border: '#FFFFFF',
      error: '#FF0000',
      warning: '#FFA500',
      success: '#00FF00'
    });
  }

  /**
   * 检测当前主题
   */
  private detectCurrentTheme(): void {
    const config = vscode.workspace.getConfiguration();
    const colorTheme = config.get<string>('workbench.colorTheme', '');
    
    if (colorTheme.toLowerCase().includes('light')) {
      this.currentTheme = 'light';
    } else if (colorTheme.toLowerCase().includes('high contrast') || colorTheme.toLowerCase().includes('hc')) {
      this.currentTheme = 'hc';
    } else {
      this.currentTheme = 'dark';
    }

    console.log(`[ThemeAdapter] Detected theme: ${this.currentTheme}`);
  }

  /**
   * 设置主题变化监听
   */
  private setupThemeListener(): void {
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('workbench.colorTheme')) {
        this.detectCurrentTheme();
        this.themeChangeEmitter.fire();
      }
    });
  }

  /**
   * 获取当前主题颜色
   */
  getCurrentThemeColors(): ThemeColors {
    return this.themeColors.get(this.currentTheme) || this.themeColors.get('dark')!;
  }

  /**
   * 获取主题感知的颜色
   */
  getThemeColor(colorName: keyof ThemeColors): string {
    const colors = this.getCurrentThemeColors();
    return colors[colorName];
  }

  /**
   * 获取CSS变量格式的颜色
   */
  getCssVariable(colorName: keyof ThemeColors): string {
    const color = this.getThemeColor(colorName);
    return `var(--live-code-${colorName}, ${color})`;
  }

  /**
   * 生成Webview的CSS样式
   */
  generateWebviewStyles(): string {
    const colors = this.getCurrentThemeColors();
    
    return `
      <style>
        :root {
          --live-code-primary: ${colors.primary};
          --live-code-secondary: ${colors.secondary};
          --live-code-accent: ${colors.accent};
          --live-code-background: ${colors.background};
          --live-code-foreground: ${colors.foreground};
          --live-code-border: ${colors.border};
          --live-code-error: ${colors.error};
          --live-code-warning: ${colors.warning};
          --live-code-success: ${colors.success};
        }

        .live-code-container {
          background: var(--live-code-background);
          color: var(--live-code-foreground);
          font-family: var(--vscode-font-family);
          padding: 20px;
        }

        .live-code-header {
          border-bottom: 1px solid var(--live-code-border);
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .live-code-button {
          background: var(--live-code-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--vscode-font-family);
        }

        .live-code-button:hover {
          background: var(--live-code-accent);
        }

        .live-code-button:disabled {
          background: var(--live-code-secondary);
          opacity: 0.6;
          cursor: not-allowed;
        }

        .live-code-card {
          background: var(--vscode-input-background);
          border: 1px solid var(--live-code-border);
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .live-code-success {
          color: var(--live-code-success);
        }

        .live-code-warning {
          color: var(--live-code-warning);
        }

        .live-code-error {
          color: var(--live-code-error);
        }

        .live-code-input {
          background: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--live-code-border);
          border-radius: 4px;
          padding: 8px 12px;
          font-family: var(--vscode-font-family);
        }

        .live-code-input:focus {
          border-color: var(--live-code-primary);
          outline: none;
        }

        .live-code-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .live-code-list-item {
          padding: 8px 12px;
          border-bottom: 1px solid var(--live-code-border);
        }

        .live-code-list-item:last-child {
          border-bottom: none;
        }

        .live-code-list-item:hover {
          background: var(--vscode-list-hoverBackground);
        }

        .live-code-status-excellent {
          color: var(--live-code-success);
        }

        .live-code-status-good {
          color: var(--live-code-accent);
        }

        .live-code-status-fair {
          color: var(--live-code-warning);
        }

        .live-code-status-poor {
          color: var(--live-code-error);
        }
      </style>
    `;
  }

  /**
   * 适配状态栏颜色
   */
  adaptStatusBarColor(
    statusBarItem: vscode.StatusBarItem,
    type: 'default' | 'success' | 'warning' | 'error'
  ): void {
    const colors = this.getCurrentThemeColors();
    
    switch (type) {
      case 'success':
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.successBackground');
        break;
      case 'warning':
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case 'error':
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      default:
        statusBarItem.backgroundColor = undefined;
    }
  }

  /**
   * 获取高对比度适配的设置
   */
  getHighContrastSettings(): {
    fontSize: number;
    fontWeight: string;
    borderWidth: string;
  } {
    if (this.currentTheme === 'hc') {
      return {
        fontSize: 14,
        fontWeight: 'bold',
        borderWidth: '2px'
      };
    } else {
      return {
        fontSize: 13,
        fontWeight: 'normal',
        borderWidth: '1px'
      };
    }
  }

  /**
   * 检查是否为高对比度模式
   */
  isHighContrastMode(): boolean {
    return this.currentTheme === 'hc';
  }

  /**
   * 获取主题信息
   */
  getThemeInfo(): {
    name: string;
    type: 'light' | 'dark' | 'hc';
    colors: ThemeColors;
  } {
    return {
      name: this.currentTheme,
      type: this.currentTheme as 'light' | 'dark' | 'hc',
      colors: this.getCurrentThemeColors()
    };
  }

  /**
   * 注册自定义颜色配置
   */
  registerCustomColors(customColors: Partial<ThemeColors>): void {
    const currentColors = this.getCurrentThemeColors();
    const newColors = { ...currentColors, ...customColors };
    this.themeColors.set(this.currentTheme, newColors);
  }

  dispose(): void {
    this.themeChangeEmitter.dispose();
  }
}