#!/usr/bin/env node

/**
 * 发布用户调研问卷的脚本
 */

const fs = require('fs');
const path = require('path');

class SurveyPublisher {
  constructor() {
    this.surveyTemplate = path.join(__dirname, 'user-survey-template.md');
    this.outputDir = path.join(__dirname, '../docs');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 生成问卷发布版本
   */
  generatePublishedSurvey() {
    const surveyContent = fs.readFileSync(this.surveyTemplate, 'utf8');
    
    // 添加发布信息
    const publishedContent = `# Live Code Viewer v0.1.0 用户调研

**发布时间**: ${new Date().toISOString().split('T')[0]}
**目标用户**: 5位 v0.1.0 安装用户
**调研周期**: 2026-03-06 至 2026-03-10

---

${surveyContent}

---

## 📊 调研数据使用说明

### 数据收集目的
- 了解 v0.1.0 新功能用户体验
- 识别产品改进机会
- 规划 v0.2.0 功能开发

### 隐私保护
- 所有反馈数据将匿名处理
- 仅用于产品改进目的
- 不会用于商业营销

### 反馈渠道
1. **GitHub Issues**: [提交反馈](https://github.com/bad-superman/live_code_viewer/issues)
2. **VS Code Marketplace**: [评论页面](https://marketplace.visualstudio.com/items?itemName=RoyKou.live-code-viewer)
3. **直接邮件**: 项目维护邮箱

### 调研奖励
参与完整调研的用户将：
- 获得 v0.2.0 优先测试资格
- 在产品致谢页面中署名
- 获得产品定制功能建议权

**感谢您帮助我们打造更好的编程协作工具！**`;

    return publishedContent;
  }

  /**
   * 保存发布的问卷
   */
  savePublishedSurvey(content) {
    const filename = 'user-survey-v0.1.0.md';
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, content);
    console.log(`✅ 问卷保存: ${filepath}`);
    
    return filepath;
  }

  /**
   * 生成发布说明
   */
  generateReleaseNotes() {
    return `# Live Code Viewer v0.1.0 用户调研发布说明

## 🎯 发布目的
启动 v0.1.0 用户反馈收集，为 v0.2.0 开发提供数据支持。

## 📋 发布内容
- **用户调研问卷**: 全面评估 v0.1.0 新功能体验
- **反馈收集渠道**: GitHub Issues + Marketplace 评论
- **深度访谈邀请**: 面向活跃用户的深度交流

## 🚀 发布策略

### 1. 多渠道发布
- **GitHub**: 在 README 和 Issues 中发布问卷
- **Marketplace**: 在扩展描述中引导用户参与调研
- **直接联系**: 通过用户评论联系活跃用户

### 2. 参与激励
- **优先测试**: v0.2.0 版本优先体验资格
- **产品致谢**: 在项目页面中署名感谢
- **功能建议权**: 对产品发展方向的影响力

### 3. 数据收集计划
- **初步反馈**: 3月6日-3月10日
- **深度访谈**: 3月11日-3月15日
- **分析报告**: 3月16日-3月20日

## 📊 预期成果

### 用户洞察
- v0.1.0 新功能接受度评估
- 用户体验痛点和改进机会
- 用户需求优先级排序

### 产品决策
- v0.2.0 功能规划数据支持
- 产品改进方向验证
- 市场定位和差异化策略

### 用户关系
- 建立用户反馈循环
- 提升用户参与感和忠诚度
- 形成产品社区基础

---
**发布状态**: 问卷已生成，准备发布
**目标回收率**: 60% (3/5 用户)
**深度访谈目标**: 2位代表性用户`;
  }

  /**
   * 运行发布流程
   */
  run() {
    console.log('🚀 发布 Live Code Viewer v0.1.0 用户调研问卷...\n');
    
    // 生成发布的问卷
    const publishedContent = this.generatePublishedSurvey();
    const surveyPath = this.savePublishedSurvey(publishedContent);
    
    // 生成发布说明
    const releaseNotes = this.generateReleaseNotes();
    const notesPath = path.join(this.outputDir, 'survey-release-notes.md');
    fs.writeFileSync(notesPath, releaseNotes);
    console.log(`✅ 发布说明保存: ${notesPath}`);
    
    console.log('\n📋 发布完成！下一步操作:');
    console.log('1. 在 GitHub README 中添加调研链接');
    console.log('2. 在 VS Code Marketplace 描述中引导用户参与');
    console.log('3. 监控 GitHub Issues 收集反馈');
    console.log('4. 准备深度访谈筛选标准');
    
    console.log(`\n📊 问卷位置: ${surveyPath}`);
    console.log('🎯 目标: 收集 3/5 用户反馈，筛选 2 位深度访谈对象');
  }
}

// 运行发布
if (require.main === module) {
  const publisher = new SurveyPublisher();
  publisher.run();
}

module.exports = SurveyPublisher;