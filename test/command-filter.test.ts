import { CommandFilter, createDefaultCommandFilter, createStrictCommandFilter } from '../src/security/command-filter';

describe('CommandFilter', () => {
  let filter: CommandFilter;

  beforeEach(() => {
    filter = createDefaultCommandFilter();
  });

  describe('危险命令检测', () => {
    test('应该检测 rm -rf / 命令', () => {
      const result = filter.checkCommand('rm -rf /');
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('dangerous');
      expect(result.reason).toContain('危险模式');
    });

    test('应该检测 sudo su 命令', () => {
      const result = filter.checkCommand('sudo su');
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('dangerous');
    });

    test('应该检测 dd 磁盘操作命令', () => {
      const result = filter.checkCommand('dd if=/dev/zero of=/dev/sda');
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('dangerous');
    });

    test('应该检测 chmod 777 / 命令', () => {
      const result = filter.checkCommand('chmod 777 /');
      expect(result.allowed).toBe(false);
      expect(result.category).toBe('dangerous');
    });
  });

  describe('警告命令检测', () => {
    test('应该检测 rm -rf 命令（无路径）', () => {
      const result = filter.checkCommand('rm -rf');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('warning');
      expect(result.reason).toContain('警告模式');
    });

    test('应该检测 sudo 命令', () => {
      const result = filter.checkCommand('sudo apt-get update');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('warning');
    });

    test('应该检测 chmod 777 命令（无路径）', () => {
      const result = filter.checkCommand('chmod 777');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('warning');
    });
  });

  describe('安全命令检测', () => {
    test('应该允许 ls 命令', () => {
      const result = filter.checkCommand('ls');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('safe');
    });

    test('应该允许 cd 命令', () => {
      const result = filter.checkCommand('cd /home/user');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('safe');
    });

    test('应该允许 cat 命令', () => {
      const result = filter.checkCommand('cat file.txt');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('safe');
    });

    test('应该允许 grep 命令', () => {
      const result = filter.checkCommand('grep pattern file.txt');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('safe');
    });
  });

  describe('自定义危险命令', () => {
    test('应该检测自定义危险命令', () => {
      const customFilter = new CommandFilter({
        customDangerousCommands: ['dangerous-cmd']
      });
      
      const result = customFilter.checkCommand('dangerous-cmd --force');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('自定义危险命令');
    });
  });

  describe('严格模式', () => {
    test('严格模式下应该拒绝未知命令', () => {
      const strictFilter = createStrictCommandFilter();
      
      const result = strictFilter.checkCommand('unknown-command');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('严格模式下未知命令被拒绝');
    });

    test('严格模式下应该允许白名单命令', () => {
      const strictFilter = createStrictCommandFilter();
      strictFilter.addSafeCommand('custom-safe-cmd');
      
      const result = strictFilter.checkCommand('custom-safe-cmd');
      expect(result.allowed).toBe(true);
      expect(result.category).toBe('safe');
    });
  });

  describe('命令清理', () => {
    test('应该清理命令中的多余空格', () => {
      const result = filter.checkCommand('  ls   -la  ');
      expect(result.allowed).toBe(true);
    });

    test('应该移除开头的 sudo 用于模式匹配', () => {
      const result = filter.checkCommand('sudo rm -rf');
      expect(result.category).toBe('warning');
    });
  });

  describe('批量检查', () => {
    test('应该批量检查多个命令', () => {
      const commands = ['ls', 'rm -rf /', 'sudo su'];
      const results = filter.checkCommands(commands);
      
      expect(results).toHaveLength(3);
      expect(results[0].allowed).toBe(true);  // ls
      expect(results[1].allowed).toBe(false); // rm -rf /
      expect(results[2].allowed).toBe(false); // sudo su
    });
  });

  describe('完全安全检查', () => {
    test('应该识别完全安全的命令', () => {
      expect(filter.isFullySafe('ls')).toBe(true);
      expect(filter.isFullySafe('rm -rf /')).toBe(false);
      expect(filter.isFullySafe('sudo apt-get update')).toBe(false);
    });
  });
});