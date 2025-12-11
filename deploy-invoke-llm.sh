#!/bin/bash

# 部署 invoke-llm Edge Function

echo "部署: invoke-llm..."
supabase functions deploy invoke-llm

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ invoke-llm 部署成功"
    echo ""
    echo "现在可以测试游客模式下的任务创建功能了！"
else
    echo ""
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi


