#!/bin/bash
echo "🔍 GitHub 上传前安全检查..."
echo ""

echo "1. 检查 .env 文件是否在 Git 中："
if git ls-files | grep -E "\.env$|\.env\." > /dev/null; then
  echo "❌ 发现 .env 文件在 Git 中！"
  git ls-files | grep -E "\.env$|\.env\."
else
  echo "✅ 无 .env 文件在 Git 中"
fi

echo ""
echo "2. 检查源代码中是否有硬编码的 API keys："
if grep -r "sk-[a-zA-Z0-9]\{20,\}" src/ --exclude-dir=node_modules 2>/dev/null | grep -v ".example" | grep -v "//" > /dev/null; then
  echo "❌ 发现硬编码的 API keys！"
  grep -r "sk-[a-zA-Z0-9]\{20,\}" src/ --exclude-dir=node_modules 2>/dev/null | grep -v ".example" | grep -v "//"
else
  echo "✅ 源代码中无硬编码 API keys"
fi

echo ""
echo "3. 检查构建产物是否在 Git 中："
if git ls-files | grep "^dist/" > /dev/null; then
  echo "❌ 发现 dist/ 目录在 Git 中！"
  git ls-files | grep "^dist/" | head -5
else
  echo "✅ 无 dist/ 目录在 Git 中"
fi

echo ""
echo "4. 检查 Supabase 临时文件是否在 Git 中："
if git ls-files | grep "supabase/\.temp" > /dev/null; then
  echo "❌ 发现 Supabase 临时文件在 Git 中！"
  git ls-files | grep "supabase/\.temp"
else
  echo "✅ 无 Supabase 临时文件在 Git 中"
fi

echo ""
echo "5. 检查 .env.example 是否存在："
if [ -f ".env.example" ]; then
  echo "✅ .env.example 文件存在"
else
  echo "⚠️  建议创建 .env.example 文件"
fi

echo ""
echo "✅ 安全检查完成！"
