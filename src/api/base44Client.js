// Base44 兼容层 - 逐步迁移到 Supabase
// 此文件提供兼容接口，实际使用 Supabase

import { Quest, Loot, DailyChest, LongTermProject, User } from './entities';
import { Core } from './integrations';
import { invoke } from './functions';

// 创建一个兼容的 base44 对象
export const base44 = {
  // 实体操作
  entities: {
    Quest,
    Loot,
    DailyChest,
    LongTermProject
  },

  // 认证操作
  auth: User,

  // 集成操作
  integrations: {
    Core
  },

  // 函数调用
  functions: {
    invoke
  },

  // 应用日志（暂时保留为空实现）
  appLogs: {
    logUserInApp: async () => {
      // Supabase 可以通过 Edge Functions 或直接写入日志表实现
      console.log('App log (not implemented in Supabase)');
    }
  }
};

// 保持向后兼容
export default base44;
