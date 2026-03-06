#!/usr/bin/env node

/**
 * 问卷回收监控脚本
 * 跟踪用户参与情况，识别潜在访谈对象
 */

const fs = require('fs');
const path = require('path');

class SurveyResponseMonitor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.surveyResponsesFile = path.join(this.dataDir, 'survey-responses.json');
    this.ensureDataDir();
    this.loadSurveyResponses();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  loadSurveyResponses() {
    try {
      if (fs.existsSync(this.surveyResponsesFile)) {
        this.surveyData = JSON.parse(fs.readFileSync(this.surveyResponsesFile, 'utf8'));
      } else {
        this.surveyData = {
          surveyStarted: new Date().toISOString(),
          totalUsers: 5,
          targetResponseRate: 0.6, // 60%
          responses: [],
          potentialInterviewees: [],
          responseRate: 0
        };
      }
    } catch (error) {
      console.error('加载问卷数据失败:', error.message);
      this.surveyData = {
        surveyStarted: new Date().toISOString(),
        totalUsers: 5,
        targetResponseRate: 0.6,
        responses: [],
        potentialInterviewees: [],
        responseRate: 0
      };
    }
  }

  saveSurveyResponses() {
    try {
      fs.writeFileSync(this.surveyResponsesFile, JSON.stringify(this.surveyData, null, 2));
    } catch (error) {
      console.error('保存问卷数据失败:', error.message);
    }
  }

  /**
   * 模拟接收问卷响应（实际应从 GitHub Issues 等渠道获取）
   */
  simulateSurveyResponses() {
    // 模拟一些问卷响应
    const mockResponses = [
      {
        id: 'user-001',
        timestamp: new Date().toISOString(),
        usageScenario: '团队协作编程',
        usageFrequency: '每周几次',
        roomsCreated: 2,
        roomTypes: ['public', 'private'],
        connectionIssues: '偶尔遇到',
        reconnectEffectiveness: '基本有效',
        uiRating: '比较直观',
        permissionUsage: '偶尔使用',
        installationExperience: '比较顺利',
        performanceRating: '比较流畅',
        featureRequests: ['实时代码注释', '更好的权限管理'],
        improvementSuggestions: ['简化房间创建流程', '增加快捷键支持'],
        contactWilling: true,
        contactInfo: 'user001@example.com'
      },
      {
        id: 'user-002',
        timestamp: new Date().toISOString(),
        usageScenario: '编程教学',
        usageFrequency: '每周1-2次',
        roomsCreated: 1,
        roomTypes: ['public'],
        connectionIssues: '从未遇到',
        reconnectEffectiveness: '非常有效',
        uiRating: '非常直观',
        permissionUsage: '从未使用',
        installationExperience: '非常顺利',
        performanceRating: '非常流畅',
        featureRequests: ['移动端支持', '代码变更历史'],
        improvementSuggestions: ['优化状态栏显示', '增加主题适配'],
        contactWilling: false
      }
    ];

    // 只添加新的响应
    mockResponses.forEach(response => {
      const existingResponse = this.surveyData.responses.find(r => r.id === response.id);
      if (!existingResponse) {
        this.surveyData.responses.push(response);
      }
    });

    this.updateResponseMetrics();
    this.identifyPotentialInterviewees();
  }

  /**
   * 更新响应指标
   */
  updateResponseMetrics() {
    this.surveyData.responseRate = this.surveyData.responses.length / this.surveyData.totalUsers;
    this.surveyData.lastUpdated = new Date().toISOString();
  }

  /**
   * 识别潜在访谈对象
   */
  identifyPotentialInterviewees() {
    this.surveyData.potentialInterviewees = this.surveyData.responses
      .filter(response => {
        // 筛选标准：愿意联系 + 提供详细反馈
        return response.contactWilling && 
               response.featureRequests && 
               response.featureRequests.length > 0 &&
               response.improvementSuggestions &&
               response.improvementSuggestions.length > 0;
      })
      .map(response => ({
        id: response.id,
        usageScenario: response.usageScenario,
        usageFrequency: response.usageFrequency,
        featureRequests: response.featureRequests,
        improvementSuggestions: response.improvementSuggestions,
        contactInfo: response.contactInfo
      }));
  }

  /**
   * 生成问卷回收报告
   */
  generateSurveyReport() {
    const responseCount = this.surveyData.responses.length;
    const targetCount = Math.ceil(this.surveyData.totalUsers * this.surveyData.targetResponseRate);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalUsers: this.surveyData.totalUsers,
        responsesReceived: responseCount,
        responseRate: (this.surveyData.responseRate * 100).toFixed(1) + '%',
        targetResponseRate: (this.surveyData.targetResponseRate * 100).toFixed(1) + '%',
        targetAchieved: responseCount >= targetCount
      },
      responseAnalysis: {
        usageScenarios: this.analyzeUsageScenarios(),
        featureUsage: this.analyzeFeatureUsage(),
        userRatings: this.analyzeUserRatings(),
        commonRequests: this.analyzeCommonRequests()
      },
      interviewCandidates: {
        totalCandidates: this.surveyData.potentialInterviewees.length,
        candidates: this.surveyData.potentialInterviewees,
        selectionStatus: this.surveyData.potentialInterviewees.length >= 2 ? 'Sufficient' : 'Need more'
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * 分析使用场景
   */
  analyzeUsageScenarios() {
    const scenarios = {};
    this.surveyData.responses.forEach(response => {
      scenarios[response.usageScenario] = (scenarios[response.usageScenario] || 0) + 1;
    });
    return scenarios;
  }

  /**
   * 分析功能使用
   */
  analyzeFeatureUsage() {
    const usage = {
      multiRoom: 0,
      permissions: 0,
      stableConnection: 0
    };

    this.surveyData.responses.forEach(response => {
      if (response.roomsCreated > 1) usage.multiRoom++;
      if (response.permissionUsage !== '从未使用') usage.permissions++;
      if (response.connectionIssues === '从未遇到') usage.stableConnection++;
    });

    return usage;
  }

  /**
   * 分析用户评分
   */
  analyzeUserRatings() {
    const ratings = {
      uiSatisfaction: 0,
      performanceSatisfaction: 0,
      installationSatisfaction: 0
    };

    this.surveyData.responses.forEach(response => {
      if (response.uiRating.includes('非常') || response.uiRating.includes('比较')) ratings.uiSatisfaction++;
      if (response.performanceRating.includes('非常') || response.performanceRating.includes('比较')) ratings.performanceSatisfaction++;
      if (response.installationExperience.includes('非常') || response.installationExperience.includes('比较')) ratings.installationSatisfaction++;
    });

    return ratings;
  }

  /**
   * 分析共同需求
   */
  analyzeCommonRequests() {
    const requests = {};
    this.surveyData.responses.forEach(response => {
      if (response.featureRequests) {
        response.featureRequests.forEach(request => {
          requests[request] = (requests[request] || 0) + 1;
        });
      }
    });

    // 排序并返回前5个
    return Object.entries(requests)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([request, count]) => ({ request, count }));
  }

  /**
   * 生成推荐
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.surveyData.responseRate < this.surveyData.targetResponseRate) {
      recommendations.push('需要增加问卷推广力度');
    }

    if (this.surveyData.potentialInterviewees.length < 2) {
      recommendations.push('需要识别更多深度访谈候选人');
    }

    const responseCount = this.surveyData.responses.length;
    if (responseCount > 0) {
      recommendations.push(`已收集 ${responseCount} 份问卷，准备进行初步分析`);
    }

    if (responseCount >= 2) {
      recommendations.push('可以开始准备深度访谈邀请');
    }

    return recommendations;
  }

  /**
   * 运行监控
   */
  run() {
    console.log('🚀 监控问卷回收情况...\n');
    
    // 模拟接收问卷响应
    this.simulateSurveyResponses();
    this.saveSurveyResponses();
    
    // 生成报告
    const report = this.generateSurveyReport();
    
    // 输出结果
    console.log('📊 问卷回收状态:');
    console.log(`   总用户数: ${report.summary.totalUsers}`);
    console.log(`   已回收问卷: ${report.summary.responsesReceived}`);
    console.log(`   回收率: ${report.summary.responseRate}`);
    console.log(`   目标回收率: ${report.summary.targetResponseRate}`);
    console.log(`   目标达成: ${report.summary.targetAchieved ? '✅' : '❌'}`);
    
    console.log('\n👥 深度访谈候选人:');
    console.log(`   候选人数量: ${report.interviewCandidates.totalCandidates}`);
    console.log(`   选择状态: ${report.interviewCandidates.selectionStatus}`);
    
    if (report.interviewCandidates.candidates.length > 0) {
      console.log('\n🎯 潜在访谈对象:');
      report.interviewCandidates.candidates.forEach(candidate => {
        console.log(`   - ${candidate.id}: ${candidate.usageScenario} (${candidate.usageFrequency})`);
      });
    }
    
    console.log('\n📈 使用场景分析:');
    Object.entries(report.responseAnalysis.usageScenarios).forEach(([scenario, count]) => {
      console.log(`   ${scenario}: ${count} 用户`);
    });
    
    console.log('\n🎯 推荐行动:');
    report.recommendations.forEach(rec => {
      console.log(`   • ${rec}`);
    });
    
    // 保存详细报告
    const reportPath = path.join(this.dataDir, `survey-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ 详细报告保存: ${reportPath}`);
  }
}

// 运行监控
if (require.main === module) {
  const monitor = new SurveyResponseMonitor();
  monitor.run();
}

module.exports = SurveyResponseMonitor;