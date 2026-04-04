/**
 * 危险命令过滤模块 - 简化版本
 * 
 * 这是一个最小可行产品(MVP)版本，提供基础的危险命令过滤功能。
 * 为未来扩展预留了接口。
 */

export interface CommandFilterResult {
  /** 是否允许执行 */
  allowed: boolean;
  /** 过滤原因 */
  reason?: string;
  /** 命令类别 */
  category?: 'safe' | 'warning' | 'dangerous' | 'unknown';
  /** 建议的安全替代方案 */
  suggestion?: string;
}

export interface CommandFilterOptions {
  /** 是否启用严格模式 */
  strictMode?: boolean;
  /** 是否记录所有过滤操作 */
  logFiltered?: boolean;
  /** 自定义危险命令列表 */
  customDangerousCommands?: string[];
}

/**
 * 基础危险命令过滤器
 */
export class CommandFilter {
  private options: CommandFilterOptions;
  
  /** 内置危险命令模式 */
  private readonly dangerousPatterns = [
    // 系统破坏命令
    /rm\s+-rf\s+\//,      // rm -rf /
    /rm\s+-rf\s+\.\*/,    // rm -rf .*
    /rm\s+-rf\s+\*/,      // rm -rf *
    /dd\s+.*if=.*of=/,    // dd 磁盘操作
    /mkfs\./,             // 文件系统创建
    /fdisk\s+.*\/dev/,    // 磁盘分区
    /format\s+/,          // 格式化命令
    
    // 权限提升命令
    /^sudo\s+su$/,        // sudo su
    /^sudo\s+bash$/,      // sudo bash
    /^sudo\s+sh$/,        // sudo sh
    /chmod\s+777\s+\//,   // chmod 777 /
    /chown\s+root\s+\//,  // chown root /
    
    // 网络攻击命令
    /nc\s+.*-e\s+bash/,   // netcat 反向shell
    /wget\s+.*\|.*sh/,    // wget | sh 管道执行
    /curl\s+.*\|.*sh/,    // curl | sh 管道执行
    
    // 信息窃取命令
    /cat\s+\/etc\/passwd/, // 查看密码文件
    /cat\s+\/etc\/shadow/, // 查看shadow文件
    /ssh-keygen\s+-f/,     // 生成SSH密钥
    
    // 进程控制命令
    /kill\s+-9\s+-1/,      // kill -9 -1 (杀死所有进程)
    /pkill\s+-9\s+.*/,     // pkill -9
  ];
  
  /** 警告命令模式 (需要用户确认) */
  private readonly warningPatterns = [
    /rm\s+-rf/,            // rm -rf (无路径)
    /rm\s+-r/,             // rm -r
    /chmod\s+777/,         // chmod 777
    /chown\s+root/,        // chown root
    /^sudo\s+.*/,          // 任何sudo命令（除了上面已定义为危险的）
    /apt-get\s+remove/,    // apt-get remove
    /yum\s+remove/,        // yum remove
    /pip\s+uninstall/,     // pip uninstall
    /npm\s+uninstall/,     // npm uninstall
  ];
  
  /** 安全命令白名单 */
  private readonly safeCommands = [
    'ls', 'cd', 'pwd', 'cat', 'echo', 'grep',
    'find', 'ps', 'top', 'df', 'du', 'mkdir',
    'touch', 'cp', 'mv', 'less', 'more', 'head',
    'tail', 'wc', 'sort', 'uniq', 'diff', 'file',
    'which', 'whereis', 'locate', 'updatedb'
  ];

  constructor(options: CommandFilterOptions = {}) {
    this.options = {
      strictMode: false,
      logFiltered: true,
      customDangerousCommands: [],
      ...options
    };
  }

  /**
   * 检查命令是否安全
   */
  public checkCommand(command: string): CommandFilterResult {
    // 清理命令字符串
    const cleanedCommand = this.cleanCommand(command);
    
    // 检查是否为危险命令
    const dangerousResult = this.checkDangerousCommand(cleanedCommand);
    if (!dangerousResult.allowed) {
      return dangerousResult;
    }
    
    // 检查是否为警告命令
    const warningResult = this.checkWarningCommand(cleanedCommand);
    if (warningResult.category === 'warning') {
      return warningResult;
    }
    
    // 检查是否为安全命令
    const safeResult = this.checkSafeCommand(cleanedCommand);
    if (safeResult.allowed) {
      return safeResult;
    }
    
    // 默认情况下，在非严格模式下允许执行
    if (!this.options.strictMode) {
      return {
        allowed: true,
        category: 'safe',
        reason: '命令未匹配任何过滤规则'
      };
    }
    
    // 严格模式下拒绝未知命令
    return {
      allowed: false,
      category: 'dangerous',
      reason: '严格模式下未知命令被拒绝',
      suggestion: '请将此命令添加到白名单或使用非严格模式'
    };
  }

  /**
   * 清理命令字符串
   */
  private cleanCommand(command: string): string {
    // 移除前后的空白字符
    let cleaned = command.trim();
    
    // 标准化空格
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned;
  }

  /**
   * 检查危险命令
   */
  private checkDangerousCommand(command: string): CommandFilterResult {
    // 检查自定义危险命令
    if (this.options.customDangerousCommands) {
      for (const dangerousCmd of this.options.customDangerousCommands) {
        if (command.startsWith(dangerousCmd)) {
          return {
            allowed: false,
            category: 'dangerous',
            reason: `命令匹配自定义危险命令: ${dangerousCmd}`,
            suggestion: '请使用更安全的替代方案'
          };
        }
      }
    }
    
    // 检查内置危险模式
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          category: 'dangerous',
          reason: `命令匹配危险模式: ${pattern.toString()}`,
          suggestion: '此命令可能破坏系统，请勿执行'
        };
      }
    }
    
    return {
      allowed: true,
      category: 'safe'
    };
  }

  /**
   * 检查警告命令
   */
  private checkWarningCommand(command: string): CommandFilterResult {
    for (const pattern of this.warningPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: true, // 警告命令允许执行，但需要用户确认
          category: 'warning',
          reason: `命令匹配警告模式: ${pattern.toString()}`,
          suggestion: '请确认此命令不会对系统造成损害'
        };
      }
    }
    
    return {
      allowed: true,
      category: 'safe'
    };
  }

  /**
   * 检查安全命令
   */
  private checkSafeCommand(command: string): CommandFilterResult {
    // 提取命令名称（第一个单词）
    const commandName = command.split(' ')[0];
    
    // 检查是否在白名单中
    if (this.safeCommands.includes(commandName)) {
      return {
        allowed: true,
        category: 'safe',
        reason: `命令在白名单中: ${commandName}`
      };
    }
    
    return {
      allowed: false,
      category: 'unknown'
    };
  }

  /**
   * 添加自定义危险命令
   */
  public addDangerousCommand(pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
      this.options.customDangerousCommands!.push(pattern);
    } else {
      this.dangerousPatterns.push(pattern);
    }
  }

  /**
   * 添加自定义警告命令
   */
  public addWarningCommand(pattern: RegExp): void {
    this.warningPatterns.push(pattern);
  }

  /**
   * 添加安全命令到白名单
   */
  public addSafeCommand(command: string): void {
    if (!this.safeCommands.includes(command)) {
      this.safeCommands.push(command);
    }
  }

  /**
   * 获取当前配置
   */
  public getOptions(): CommandFilterOptions {
    return { ...this.options };
  }

  /**
   * 更新配置
   */
  public updateOptions(newOptions: Partial<CommandFilterOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 批量检查多个命令
   */
  public checkCommands(commands: string[]): CommandFilterResult[] {
    return commands.map(cmd => this.checkCommand(cmd));
  }

  /**
   * 验证命令是否完全安全（无警告）
   */
  public isFullySafe(command: string): boolean {
    const result = this.checkCommand(command);
    return result.allowed && result.category === 'safe';
  }
}

/**
 * 创建默认命令过滤器
 */
export function createDefaultCommandFilter(): CommandFilter {
  return new CommandFilter({
    strictMode: false,
    logFiltered: true,
    customDangerousCommands: []
  });
}

/**
 * 创建严格模式命令过滤器
 */
export function createStrictCommandFilter(): CommandFilter {
  return new CommandFilter({
    strictMode: true,
    logFiltered: true,
    customDangerousCommands: []
  });
}