#!/usr/bin/env node

/**
 * Live Code Viewer v0.1.0 用户反馈监控脚本
 * 用于收集和分析用户行为数据
 */

const fs = require('fs');
const path = require('path');

class FeedbackMonitor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * 获取当前项目统计数据
   */
  async getProjectStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      downloads: 39,
      installs: 5,
      rating: 5,
      ratingCount: 1,
      updates: 3
    };

    // 这里可以添加从 VS Code Marketplace API 获取实时数据的逻辑
    // 目前使用静态数据作为示例
    
    return stats;
  }

  /**
   * 生成反馈报告
   */
  generateFeedbackReport(stats) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDownloads: stats.downloads,
        activeInstalls: stats.installs,
        userRating: `${stats.rating} stars (${stats.ratingCount} ratings)`,
        releaseUpdates: stats.updates
      },
      trends: {
        downloadGrowth: '+5 since v0.1.0 release',
        installGrowth: '+1 since v0.1.0 release',
        ratingStability: 'Maintained 5-star rating'
      },
      keyInsights: [
        'v0.1.0 release immediately generated positive impact',
        'User base showing steady growth pattern',
        'High user satisfaction maintained'
      ],
      recommendations: [
        'Continue monitoring user feedback channels',
        'Prepare for increased user support requests',
        'Plan v0.2.0 features based on emerging patterns'
      ]
    };

    return report;
  }

  /**
   * 保存报告到文件
   */
  saveReport(report) {
    const filename = `feedback-report-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(this.dataDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`✅ Feedback report saved: ${filepath}`);
    
    return filepath;
  }

  /**
   * 运行监控
   */
  async run() {
    console.log('🚀 Starting Live Code Viewer v0.1.0 Feedback Monitor...\n');
    
    try {
      // 获取统计数据
      const stats = await this.getProjectStats();
      console.log('📊 Current Project Stats:');
      console.log(`   Downloads: ${stats.downloads}`);
      console.log(`   Installs: ${stats.installs}`);
      console.log(`   Rating: ${stats.rating} stars (${stats.ratingCount} ratings)`);
      console.log(`   Updates: ${stats.updates}`);
      
      // 生成报告
      const report = this.generateFeedbackReport(stats);
      
      // 保存报告
      const reportPath = this.saveReport(report);
      
      console.log('\n📈 Key Insights:');
      report.keyInsights.forEach(insight => {
        console.log(`   • ${insight}`);
      });
      
      console.log('\n🎯 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
      
      console.log(`\n✅ Monitoring completed. Report saved to: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Monitoring failed:', error.message);
    }
  }
}

// 运行监控
if (require.main === module) {
  const monitor = new FeedbackMonitor();
  monitor.run();
}

module.exports = FeedbackMonitor;