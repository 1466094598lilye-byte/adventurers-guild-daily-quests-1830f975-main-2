import { createClient } from '@supabase/supabase-js'

// Vite 项目使用 import.meta.env，不是 process.env
// 注意：这些值会暴露在前端代码中，但 Supabase ANON KEY 设计上就是公开的
// 安全性通过 Row Level Security (RLS) 保证
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)



