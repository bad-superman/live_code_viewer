#!/usr/bin/env node

/**
 * 设置每日用户反馈监控的定时任务
 */

const fs = require('fs');
const path = require('path');

class CronSetup {
  constructor() {
    this.scriptPath = path.join(__dirname, 'auto-monitor.js');
    this.cronConfig = {
      schedule: '0 9,18 * * *', // 每天9:00和18:00运行
      description: 'Live Code Viewer 用户反馈监控'
    };
  }

  /**
   * 生成 crontab 配置
   */
  generateCrontabConfig() {
    const nodePath = process.execPath;
    const command = `${nodePath} ${this.scriptPath}`;
    
    return `# ${this.cronConfig.description}
${this.cronConfig.schedule} ${command} >> ${path.join(__dirname, '../logs/monitor.log')} 2>&1`;
  }

  /**
   * 生成 systemd 定时器配置
   */
  generateSystemdConfig() {
    return `[Unit]
Description=${this.cronConfig.description}

[Timer]
OnCalendar=*-*-* 09:00:00
OnCalendar=*-*-* 18:00:00
Persistent=true

[Install]
WantedBy=timers.target`;
  }

  /**
   * 生成 setup 脚本
   */
  generateSetupScript() {
    const cronJob = `0 9,18 * * * $(which node) ${this.scriptPath} >> ${path.join(__dirname, '../logs/monitor.log')} 2>&1`;
    
    return `#!/bin/bash
# Live Code Viewer 用户反馈监控设置脚本

echo "🚀 设置 Live Code Viewer 用户反馈监控..."

# 创建日志目录
mkdir -p ../logs

# 检查是否支持 crontab
if command -v crontab >/dev/null 2>&1; then
    echo "📅 设置 crontab 定时任务..."
    
    # 添加到当前用户的 crontab
    (crontab -l 2>/dev/null | grep -v "${this.scriptPath}"; echo "${cronJob}") | crontab -
    echo "✅ Crontab 定时任务设置完成"
else
    echo "⚠️  未找到 crontab，跳过定时任务设置"
fi

echo ""
echo "📊 监控配置:"
echo "   脚本: ${this.scriptPath}"
echo "   时间: 每天 09:00 和 18:00"
echo "   日志: ${path.join(__dirname, '../logs/monitor.log')}"
echo ""
echo "🎯 手动运行监控:"
echo "   node ${this.scriptPath}"
echo ""
echo "✅ 监控设置完成！"`;
  }

  /**
   * 保存配置
   */
  saveConfigs() {
    const configs = {
      'setup-monitor.sh': this.generateSetupScript(),
      'crontab-config.txt': this.generateCrontabConfig(),
      'systemd-timer.service': this.generateSystemdConfig()
    };

    Object.entries(configs).forEach(([filename, content]) => {
      const filepath = path.join(__dirname, filename);
      fs.writeFileSync(filepath, content);
      
      if (filename === 'setup-monitor.sh') {
        fs.chmodSync(filepath, 0o755); // 设置可执行权限
      }
      
      console.log(`✅ 生成 ${filename}`);
    });
  }

  run() {
    console.log('🚀 生成用户反馈监控定时任务配置...\n');
    this.saveConfigs();
    
    console.log('\n📋 使用说明:');
    console.log('1. 运行设置脚本:');
    console.log('   ./scripts/setup-monitor.sh');
    console.log('');
    console.log('2. 手动运行监控:');
    console.log('   node scripts/auto-monitor.js');
    console.log('');
    console.log('3. 查看监控日志:');
    console.log('   tail -f logs/monitor.log');
    console.log('');
    console.log('🎯 监控将每天自动运行两次，收集用户数据并生成报告');
  }
}

// 运行设置
if (require.main === module) {
  const setup = new CronSetup();
  setup.run();
}

module.exports = CronSetup;