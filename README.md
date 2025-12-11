# 🎮 Adventurers Guild - Daily Quests

一个有趣的每日任务管理应用，帮助你规划和完成日常任务，以 RPG 游戏的方式提升生活效率。

## ✨ 功能特性

- 🎯 **任务管理** - 创建、编辑、完成每日任务
- 🏆 **成就系统** - 完成任务获得宝物和奖励
- 📅 **长期项目规划** - 规划和管理长期目标
- 📊 **数据统计** - 查看完成情况和连续打卡记录
- 🎨 **PWA 支持** - 可安装为原生应用，支持离线使用
- 👤 **游客模式** - 无需登录即可使用大部分功能
- 🔄 **数据迁移** - 登录后自动迁移游客数据

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境变量配置

1. 复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的 Supabase 配置：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**注意**：Deep Seek API Key 需要在 Supabase Edge Functions 中设置，而不是在 `.env` 文件中。

### 本地开发

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## 📦 部署

### 部署到 Vercel

1. **连接 GitHub 仓库**
   - 在 Vercel 中导入你的 GitHub 仓库
   - Vercel 会自动检测 Vite 项目配置

2. **设置环境变量**
   - 进入项目设置 → Environment Variables
   - 添加以下变量：
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
     ```

3. **部署**
   - Vercel 会自动构建和部署
   - 每次推送到 GitHub 都会自动重新部署

### 部署 Supabase Edge Functions

Deep Seek API Key 需要在 Supabase Edge Functions 中设置：

```bash
# 设置 Deep Seek API Key
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key

# 部署 Edge Functions
supabase functions deploy invoke-llm
```

## 🔧 技术栈

- **前端框架**: React + Vite
- **UI 组件**: Radix UI + Tailwind CSS
- **状态管理**: React Query (@tanstack/react-query)
- **后端**: Supabase (Auth + PostgreSQL + Edge Functions)
- **LLM**: Deep Seek API (通过 Edge Functions)
- **PWA**: vite-plugin-pwa

## 📁 项目结构

```
├── src/
│   ├── components/     # React 组件
│   ├── pages/          # 页面组件
│   ├── lib/            # 工具函数和上下文
│   ├── api/            # API 调用
│   └── entities/       # 数据模型
├── supabase/
│   └── functions/      # Edge Functions
├── public/             # 静态资源
└── dist/               # 构建产物（不提交到 Git）
```

## 🔐 安全说明

- ✅ 所有敏感信息都通过环境变量管理
- ✅ `.env` 文件已添加到 `.gitignore`，不会提交到 Git
- ✅ Deep Seek API Key 存储在 Supabase Edge Functions Secrets 中
- ⚠️ Supabase ANON KEY 会暴露在前端代码中（这是设计上的，通过 RLS 保证安全）

## 📝 环境变量说明

| 变量名 | 说明 | 位置 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 前端代码 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 前端代码 |
| `DEEPSEEK_API_KEY` | Deep Seek API 密钥 | Supabase Edge Functions Secrets |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Supabase](https://supabase.com/) - 后端服务
- [Vercel](https://vercel.com/) - 部署平台
- [Deep Seek](https://www.deepseek.com/) - LLM 服务
