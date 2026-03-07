#!/bin/bash

# v0.1.1 Marketplace 发布脚本

echo "🚀 Live Code Viewer v0.1.1 Marketplace 发布脚本"
echo "================================================="

# 检查环境变量
if [ -z "$VSCE_PAT" ] && [ -z "$VS_MARKETPLACE_TOKEN" ]; then
    echo "❌ 错误: 未配置 Personal Access Token (PAT)"
    echo ""
    echo "请执行以下步骤:"
    echo "1. 访问: https://dev.azure.com/"
    echo "2. 生成新的 PAT，权限包括:"
    echo "   - Marketplace (Publish)"
    echo "   - Packaging (Read & Write)"
    echo "3. 设置环境变量:"
    echo "   export VSCE_PAT='your_personal_access_token_here'"
    echo "   # 或"
    echo "   export VS_MARKETPLACE_TOKEN='your_personal_access_token_here'"
    echo ""
    echo "然后重新运行此脚本:"
    echo "./scripts/publish-release.sh"
    exit 1
fi

# 确定使用哪个环境变量
if [ -n "$VSCE_PAT" ]; then
    PAT="$VSCE_PAT"
    echo "✅ 使用 VSCE_PAT 环境变量"
elif [ -n "$VS_MARKETPLACE_TOKEN" ]; then
    PAT="$VS_MARKETPLACE_TOKEN"
    echo "✅ 使用 VS_MARKETPLACE_TOKEN 环境变量"
fi

echo ""
echo "📦 开始发布 v0.1.1 到 VS Code Marketplace..."

# 执行发布
npx vsce publish --pat "$PAT"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 v0.1.1 发布成功！"
    echo ""
    echo "📊 发布验证:"
    echo "- 访问: https://marketplace.visualstudio.com/manage/publishers/roykou"
    echo "- 确认 v0.1.1 版本状态"
    echo "- 检查扩展页面更新"
    echo ""
    echo "🔍 发布后监控:"
    echo "- 监控下载量增长 (当前: 43)"
    echo "- 监控安装数增长 (当前: 6)"
    echo "- 收集用户反馈"
else
    echo ""
    echo "❌ v0.1.1 发布失败！"
    echo "请检查:"
    echo "- PAT 权限是否正确配置"
    echo "- 网络连接是否正常"
    echo "- 版本号是否重复"
fi