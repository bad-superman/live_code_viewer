#!/usr/bin/env ts-node

/**
 * 危险命令过滤演示脚本
 * 
 * 这个脚本展示了命令过滤器的基本功能和使用方法。
 */

import { CommandFilter, createDefaultCommandFilter, createStrictCommandFilter } from '../src/security/command-filter';

function printResult(command: string, result: any) {
  const status = result.allowed ? '✅ 允许' : '❌ 拒绝';
  const category = result.category || 'unknown';
  const reason = result.reason || '无';
  const suggestion = result.suggestion || '无';
  
  console.log(`命令: "${command}"`);
  console.log(`  状态: ${status}`);
  console.log(`  类别: ${category}`);
  console.log(`  原因: ${reason}`);
  console.log(`  建议: ${suggestion}`);
  console.log('---');
}

function demoBasicFiltering() {
  console.log('=== 基础命令过滤演示 ===\n');
  
  const filter = createDefaultCommandFilter();
  
  const testCommands = [
    'ls -la',
    'rm -rf /',
    'sudo apt-get update',
    'sudo su',
    'cat /etc/passwd',
    'chmod 777 /tmp/test',
    'dd if=/dev/zero of=/dev/sda',
    'echo "Hello World"',
    'rm -rf node_modules',
    'sudo rm -rf /tmp/*'
  ];
  
  testCommands.forEach(command => {
    const result = filter.checkCommand(command);
    printResult(command, result);
  });
}

function demoStrictMode() {
  console.log('\n=== 严格模式演示 ===\n');
  
  const strictFilter = createStrictCommandFilter();
  
  const testCommands = [
    'ls',
    'custom-command',
    'unknown-tool',
    'special-script.sh'
  ];
  
  testCommands.forEach(command => {
    const result = strictFilter.checkCommand(command);
    printResult(command, result);
  });
  
  // 添加自定义安全命令
  console.log('\n=== 添加自定义安全命令后 ===\n');
  strictFilter.addSafeCommand('custom-command');
  strictFilter.addSafeCommand('special-script.sh');
  
  testCommands.forEach(command => {
    const result = strictFilter.checkCommand(command);
    printResult(command, result);
  });
}

function demoCustomRules() {
  console.log('\n=== 自定义规则演示 ===\n');
  
  const customFilter = new CommandFilter({
    customDangerousCommands: ['dangerous-script', 'unsafe-tool'],
    logFiltered: true
  });
  
  // 添加自定义警告模式
  customFilter.addWarningCommand(/restart-service/);
  
  const testCommands = [
    'dangerous-script --force',
    'unsafe-tool --delete-all',
    'restart-service apache2',
    'safe-command --help'
  ];
  
  testCommands.forEach(command => {
    const result = customFilter.checkCommand(command);
    printResult(command, result);
  });
}

function demoBatchChecking() {
  console.log('\n=== 批量检查演示 ===\n');
  
  const filter = createDefaultCommandFilter();
  
  const commandList = [
    'ls',
    'cd /home',
    'sudo apt-get install package',
    'rm -rf /',
    'cat file.txt',
    'sudo rm -rf /tmp/cache'
  ];
  
  console.log('批量检查命令列表:');
  commandList.forEach((cmd, i) => {
    console.log(`  ${i + 1}. ${cmd}`);
  });
  
  console.log('\n检查结果:');
  const results = filter.checkCommands(commandList);
  
  results.forEach((result, i) => {
    const status = result.allowed ? '✅' : '❌';
    console.log(`  ${status} ${commandList[i]}`);
  });
  
  // 统计
  const allowedCount = results.filter(r => r.allowed).length;
  const deniedCount = results.filter(r => !r.allowed).length;
  
  console.log(`\n统计: ${allowedCount} 个允许, ${deniedCount} 个拒绝`);
}

function main() {
  console.log('🚀 危险命令过滤功能演示\n');
  
  demoBasicFiltering();
  demoStrictMode();
  demoCustomRules();
  demoBatchChecking();
  
  console.log('\n🎉 演示完成！');
  console.log('\n总结:');
  console.log('1. 基础过滤: 检测常见危险命令');
  console.log('2. 严格模式: 只允许白名单命令');
  console.log('3. 自定义规则: 支持用户自定义过滤规则');
  console.log('4. 批量检查: 高效处理多个命令');
  console.log('5. 多层防护: 客户端和主机端双重验证');
}

if (require.main === module) {
  main();
}

export { demoBasicFiltering, demoStrictMode, demoCustomRules, demoBatchChecking };