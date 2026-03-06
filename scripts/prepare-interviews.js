#!/usr/bin/env node

/**
 * 深度访谈准备脚本
 * 筛选访谈对象，准备访谈大纲和问题
 */

const fs = require('fs');
const path = require('path');

class InterviewPreparer {
  constructor() {
    this.outputDir = path.join(__dirname, '../docs');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 生成访谈对象筛选标准
   */
  generateSelectionCriteria() {
    return {
      criteria: {
        usageFrequency: {
          high: '每天或每周多次使用',
          medium: '每周1-2次使用',
          low: '偶尔使用'
        },
        featureUsage: {
          multiRoom: '使用多房间功能',
          permissions: '使用权限管理功能',
          stability: '关注连接稳定性'
        },
        feedbackQuality: {
          detailed: '提供详细的功能反馈',
          constructive: '提出建设性改进建议',
          enthusiastic: '表现出浓厚兴趣'
        }
      },
      targetProfiles: [
        {
          type: '高级用户',
          description: '频繁使用，深度体验多个功能',
          selectionWeight: 1.0
        },
        {
          type: '典型用户',
          description: '中等使用频率，代表大多数用户',
          selectionWeight: 0.8
        },
        {
          type: '新用户',
          description: '最近开始使用，提供新鲜视角',
          selectionWeight: 0.6
        }
      ]
    };
  }

  /**
   * 生成深度访谈大纲
   */
  generateInterviewOutline() {
    return `# Live Code Viewer v0.1.0 深度访谈大纲

## 🎯 访谈目标
深入了解用户对 v0.1.0 新功能的体验，识别关键改进机会，验证产品发展方向。

## 👥 访谈对象
- **目标人数**: 2-3 位代表性用户
- **访谈时长**: 30-45 分钟
- **访谈方式**: 视频会议或语音通话

## 📋 访谈结构

### 第一部分：使用背景 (5分钟)
**目标**: 了解用户的基本使用场景和背景

#### 引导问题
1. "请简单介绍一下您使用 Live Code Viewer 的主要场景？"
2. "在什么情况下您会选择使用这个扩展？"
3. "您通常与多少人一起协作编程？"

### 第二部分：v0.1.0 功能体验 (15分钟)
**目标**: 深入评估新功能的使用体验

#### 多房间支持
4. "您创建了多少个房间？主要使用哪种类型？为什么？"
5. "多房间功能对您的协作流程有何影响？"
6. "在房间管理方面有什么困难或建议？"

#### 连接稳定性
7. "您是否遇到过连接问题？自动重连效果如何？"
8. "连接质量监控对您的使用信心有何影响？"
9. "在网络条件不佳时，扩展的表现如何？"

#### 用户界面
10. "三栏状态栏的信息展示是否清晰直观？"
11. "Webview 房间面板的操作体验如何？"
12. "整体界面设计是否符合您的使用习惯？"

#### 权限管理
13. "您是否使用了权限设置功能？使用场景是什么？"
14. "当前的权限管理是否满足您的需求？"
15. "在权限控制方面还有什么期待？"

### 第三部分：整体体验和改进建议 (10分钟)
**目标**: 收集整体反馈和改进建议

#### 使用体验
16. "安装和配置过程是否顺利？"
17. "扩展运行是否流畅？对 VS Code 性能有无影响？"
18. "您是否遇到过崩溃或异常情况？"

#### 改进建议
19. "您觉得当前版本缺少哪些重要功能？"
20. "在界面和交互方面有什么具体改进建议？"
21. "您还希望在哪些场景中使用此扩展？"

### 第四部分：未来展望 (5分钟)
**目标**: 了解用户对产品未来的期待

#### 功能愿景
22. "如果可以实现任何功能，您最希望看到什么？"
23. "您认为这个扩展在哪些方面可以做得更好？"
24. "您会向同事或朋友推荐这个扩展吗？为什么？"

## 🎯 访谈技巧

### 建立信任
- 明确访谈目的和数据使用方式
- 强调用户的反馈对产品改进的重要性
- 营造轻松、开放的交流氛围

### 深度挖掘
- 使用 "为什么" 和 "请详细说明" 引导深入讨论
- 关注用户的情感和使用感受
- 记录具体的用例和场景描述

### 避免引导
- 使用开放式问题，避免暗示性提问
- 让用户自由表达想法和感受
- 关注用户自发提到的痛点和需求

## 📊 数据记录

### 记录要点
- 用户的具体使用场景和用例
- 功能体验中的痛点和愉悦点
- 改进建议的优先级和影响范围
- 用户对产品的情感态度和忠诚度

### 分析方法
- 主题分析：识别共同的主题和模式
- 痛点聚类：将相似的问题归类分析
- 优先级评估：基于影响范围和实现难度排序

## 🚀 后续行动

### 访谈后
1. **及时整理**: 24小时内完成访谈记录整理
2. **初步分析**: 识别关键洞察和改进机会
3. **用户反馈**: 向参与者发送感谢和初步发现

### 数据整合
1. **多源整合**: 结合问卷数据和访谈洞察
2. **模式识别**: 识别用户行为的共同模式
3. **决策支持**: 为 v0.2.0 规划提供数据支持

---
**准备状态**: 访谈大纲和筛选标准就绪
**执行时间**: 2026-03-11 至 2026-03-15
**预期收获**: 深度用户洞察，关键改进方向`;
  }

  /**
   * 生成访谈邀请模板
   */
  generateInvitationTemplate() {
    return `# Live Code Viewer 深度访谈邀请

## 🎯 邀请函

亲爱的 Live Code Viewer 用户，

感谢您使用我们的扩展！我们注意到您对产品的深度使用和宝贵反馈，诚挚邀请您参与我们的用户深度访谈。

## 📋 访谈详情

### 目的
深入了解您对 v0.1.0 新功能的使用体验，帮助我们打造更好的编程协作工具。

### 内容
- v0.1.0 新功能使用体验
- 整体使用感受和改进建议
- 未来功能需求和期待

### 时间
- **时长**: 30-45 分钟
- **方式**: 视频会议或语音通话
- **时间安排**: 根据您的方便时间安排

### 参与奖励
- **v0.2.0 优先测试资格**: 第一时间体验新功能
- **产品致谢**: 在项目页面中特别感谢
- **功能建议权**: 对产品发展方向的影响力

## 📞 联系方式

如果您愿意参与，请通过以下方式联系我们：

- **邮箱**: [项目维护邮箱]
- **GitHub**: [项目 Issues 页面]
- **其他**: [其他联系方式]

## 🎁 额外福利

所有参与访谈的用户还将获得：
- 个性化的产品使用建议
- 与开发团队直接交流的机会
- 未来新功能的优先体验权

我们非常重视您的意见，期待与您深入交流！

**Live Code Viewer 开发团队**`;
  }

  /**
   * 运行准备流程
   */
  run() {
    console.log('🚀 准备 Live Code Viewer v0.1.0 深度访谈...\n');
    
    // 生成筛选标准
    const selectionCriteria = this.generateSelectionCriteria();
    const criteriaPath = path.join(this.outputDir, 'interview-selection-criteria.json');
    fs.writeFileSync(criteriaPath, JSON.stringify(selectionCriteria, null, 2));
    console.log(`✅ 筛选标准保存: ${criteriaPath}`);
    
    // 生成访谈大纲
    const interviewOutline = this.generateInterviewOutline();
    const outlinePath = path.join(this.outputDir, 'interview-outline.md');
    fs.writeFileSync(outlinePath, interviewOutline);
    console.log(`✅ 访谈大纲保存: ${outlinePath}`);
    
    // 生成邀请模板
    const invitationTemplate = this.generateInvitationTemplate();
    const invitationPath = path.join(this.outputDir, 'interview-invitation-template.md');
    fs.writeFileSync(invitationPath, invitationTemplate);
    console.log(`✅ 邀请模板保存: ${invitationPath}`);
    
    console.log('\n📋 深度访谈准备完成！下一步操作:');
    console.log('1. 监控问卷回收，识别潜在访谈对象');
    console.log('2. 根据筛选标准选择 2-3 位代表性用户');
    console.log('3. 发送访谈邀请，安排访谈时间');
    console.log('4. 准备访谈记录工具和问题清单');
    
    console.log('\n🎯 目标: 完成 2-3 位用户的深度访谈，获得深度用户洞察');
  }
}

// 运行准备
if (require.main === module) {
  const preparer = new InterviewPreparer();
  preparer.run();
}

module.exports = InterviewPreparer;