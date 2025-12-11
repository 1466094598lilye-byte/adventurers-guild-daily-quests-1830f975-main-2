#!/bin/bash
# Edge Functions 一键部署脚本

echo "🚀 开始部署 Supabase Edge Functions..."
echo ""

# 检查 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI 未安装"
    echo ""
    echo "请先安装 Supabase CLI："
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  或访问: https://github.com/supabase/cli#install-the-cli"
    exit 1
fi

echo "✅ Supabase CLI 已安装"
echo ""

# 检查是否已登录
echo "📝 检查登录状态..."
if ! supabase projects list &> /dev/null; then
    echo "❌ 未登录，请先登录："
    echo "  supabase login"
    exit 1
fi

echo "✅ 已登录"
echo ""

# 链接项目（如果未链接）
echo "🔗 链接项目..."
supabase link --project-ref vxatewcklhaztdpweftm

echo ""
echo "🔐 设置加密密钥..."
echo "⚠️  请确保 ENCRYPTION_SECRET 已设置！"
echo "   如果未设置，请运行："
echo "   supabase secrets set ENCRYPTION_SECRET=your-random-secret-key"
echo ""

read -p "是否已设置 ENCRYPTION_SECRET？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 请先设置 ENCRYPTION_SECRET"
    exit 1
fi

echo ""
echo "📦 开始部署 Edge Functions..."
echo ""

# 部署所有函数
functions=(
    "encrypt-quest-data"
    "decrypt-quest-data"
    "encrypt-project-data"
    "decrypt-project-data"
    "craft-loot"
    "invoke-llm"
    "restore-user-streak"
)

for func in "${functions[@]}"; do
    echo "部署: $func..."
    supabase functions deploy "$func"
    if [ $? -eq 0 ]; then
        echo "✅ $func 部署成功"
    else
        echo "❌ $func 部署失败"
    fi
    echo ""
done

echo ""
echo "🎉 部署完成！"
echo ""
echo "下一步："
echo "1. 在 Supabase Dashboard 中创建数据库表（参见 SUPABASE_MIGRATION.md）"
echo "2. 配置 Row Level Security (RLS)"
echo "3. 配置 Google OAuth（如果需要）"
echo "4. 测试所有功能"



