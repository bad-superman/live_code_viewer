#!/bin/bash
# Live Code Viewer 用户反馈监控设置脚本

echo "🚀 设置 Live Code Viewer 用户反馈监控..."

# 创建日志目录
mkdir -p ../logs

# 检查是否支持 crontab
if command -v crontab >/dev/null 2>&1; then
    echo "📅 设置 crontab 定时任务..."
    
    # 添加到当前用户的 crontab
    (crontab -l 2>/dev/null | grep -v "/home/roy/source/live-code-viewer/scripts/auto-monitor.js"; echo "0 9,18 * * * $(which node) /home/roy/source/live-code-viewer/scripts/auto-monitor.js >> /home/roy/source/live-code-viewer/logs/monitor.log 2>&1") | crontab -
    echo "✅ Crontab 定时任务设置完成"
else
    echo "⚠️  未找到 crontab，跳过定时任务设置"
fi

echo ""
echo "📊 监控配置:"
echo "   脚本: /home/roy/source/live-code-viewer/scripts/auto-monitor.js"
echo "   时间: 每天 09:00 和 18:00"
echo "   日志: /home/roy/source/live-code-viewer/logs/monitor.log"
echo ""
echo "🎯 手动运行监控:"
echo "   node /home/roy/source/live-code-viewer/scripts/auto-monitor.js"
echo ""
echo "✅ 监控设置完成！"