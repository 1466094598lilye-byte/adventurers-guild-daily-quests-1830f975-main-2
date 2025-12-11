### 🧙‍♂️ ✨ Adventurer’s Guild – Daily Quests

Make productivity fun! Turn your tasks into quests, earn loot for staying on track, and keep your streak alive as you level up in the Adventurer’s Guild. Every time you complete a task, your AI guildmates cheer you on—celebrating your wins and keeping you motivated.

### 🚀 Features
🎯 Turn tasks into RPG-style quests Ordinary to-dos become immersive quests with themed descriptions, icons, and progression.

🪙 Earn loot and rewards Stay consistent and unlock treasure—because checking off tasks should feel fun.

🔥 AI-powered guild praise (“夸夸包”) Whenever you finish a quest, AI guild members hype you up with personalized encouragement, making productivity feel like a supportive adventure party experience.

📆 Auto-fill Daily Quest Board from bulk input One of the flagship features: You can paste an entire list of tasks or dates (even a large project plan), and the AI automatically:

* Identifies tasks & deadlines
  
* Splits big tasks into actionable subtasks
  
* Assigns them across days
  
* Inserts them into your daily quest boards A huge time-saver for planning big projects.
  
🗡️ Streak system Keep your streak alive to level up your status within the guild.

🧭 Clean, game-inspired UI A structured interface inspired by RPG quest logs.

### 🔧 Tech Stack**

Frontend Framework: React + Vite

UI Components: Radix UI + Tailwind CSS

State Management: React Query (@tanstack/react-query)

Backend: Supabase (Auth, PostgreSQL, and Edge Functions)

LLM Integration: DeepSeek API (via Edge Functions)

PWA Support: vite-plugin-pwa
  
## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

---

### Install Dependencies
```bash
npm install
```

---

### Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABABASE_ANON_KEY=your_supabase_anon_key_here
```

> **Note:** Your DeepSeek API key should be configured inside Supabase Edge Functions, not in the frontend `.env` file.

---

### Local Development
```bash
npm run dev
```

The application will be available at: 👉 http://localhost:5173

---

### Build for Production
```bash
npm run build
```

The production build will be generated in the `dist/` directory.


## 📁 Project Structure

```bash
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/          # Page-level components
│   ├── lib/            # Utilities, helpers, and context
│   ├── api/            # API wrappers and client logic
│   └── entities/       # Data models and domain definitions
├── supabase/
│   └── functions/      # Supabase Edge Functions
├── public/             # Static assets
└── dist/               # Production build output (not committed to Git)
```





### ✨ Vision

Adventurer's Guild reimagines daily productivity as a playful RPG progression loop—not just another to-do list.
By blending smart AI assistance with classic quest mechanics, the app creates a motivational system that feels engaging, game-like, and genuinely fun to use.

### 🙌 Contributions

This project is part of my personal portfolio.
Feedback, suggestions, and discussions are warmly welcome.

### ⚔️ License

This project is currently not open-source.
All rights reserved.

