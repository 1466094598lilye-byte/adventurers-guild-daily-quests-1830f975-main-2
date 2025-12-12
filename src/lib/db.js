import { supabase } from './supabase';
import { guestStorage } from './guestStorage';

/**
 * 数据库操作辅助函数
 * 支持游客模式（localStorage）和登录模式（Supabase）
 * 游客模式下，所有功能都可用，包括大项目规划
 */

// 检查是否已登录
const isAuthenticated = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && !!user;
};

// 获取当前用户（如果已登录）
const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return null; // 返回 null 表示未登录（游客模式）
  }
  return user;
};

/**
 * 查询操作 - 支持游客模式和登录模式
 */
export const dbQuery = {
  // 查询所有记录（带过滤）
  async list(tableName, orderBy = '-created_date', limit = 1000, filters = {}) {
    const user = await getCurrentUser();
    
    // 游客模式：使用 localStorage
    if (!user) {
      return guestStorage.list(tableName, orderBy, limit, filters);
    }
    
    // 登录模式：使用 Supabase
    let query = supabase.from(tableName).select('*').eq('owner_id', user.id);
    
    // 添加其他过滤条件
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    // 处理排序
    if (orderBy.startsWith('-')) {
      query = query.order(orderBy.substring(1), { ascending: false });
    } else {
      query = query.order(orderBy, { ascending: true });
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // 查询单条记录
  async get(tableName, id) {
    const user = await getCurrentUser();
    
    // 游客模式：使用 localStorage
    if (!user) {
      return guestStorage.get(tableName, id);
    }
    
    // 登录模式：使用 Supabase
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 过滤查询（替代原来的 filter 方法）
  async filter(tableName, filters = {}, orderBy = '-created_date', limit = null) {
    const user = await getCurrentUser();
    
    // 游客模式：使用 localStorage
    if (!user) {
      return guestStorage.filter(tableName, filters, orderBy, limit);
    }
    
    // 登录模式：使用 Supabase
    let query = supabase.from(tableName).select('*').eq('owner_id', user.id);
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    if (orderBy.startsWith('-')) {
      query = query.order(orderBy.substring(1), { ascending: false });
    } else {
      query = query.order(orderBy, { ascending: true });
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

/**
 * 插入操作 - 支持游客模式和登录模式
 * 所有功能都支持游客模式
 */
export const dbInsert = {
  async create(tableName, data) {
    // 获取当前用户（使用 supabase.auth.getUser()，不使用废弃的 supabase.auth.user()）
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // 游客模式：使用 localStorage
    if (authError || !user) {
      return guestStorage.create(tableName, data);
    }
    
    // 登录模式：使用 Supabase
    // 确保 owner_id 始终设置为当前用户 ID，即使传入数据中已包含 owner_id
    const insertData = {
      ...data,
      owner_id: user.id, // 强制设置为当前用户 ID，覆盖任何传入的 owner_id
      created_date: new Date().toISOString()
    };
    
    const { data: result, error } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }
};

/**
 * 更新操作 - 支持游客模式和登录模式
 */
export const dbUpdate = {
  async update(tableName, id, data) {
    const user = await getCurrentUser();
    
    // 游客模式：使用 localStorage
    if (!user) {
      return guestStorage.update(tableName, id, data);
    }
    
    // 登录模式：使用 Supabase
    const { data: result, error } = await supabase
      .from(tableName)
      .update({
        ...data,
        updated_date: new Date().toISOString()
      })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }
};

/**
 * 删除操作 - 支持游客模式和登录模式
 */
export const dbDelete = {
  async delete(tableName, id) {
    const user = await getCurrentUser();
    
    // 游客模式：使用 localStorage
    if (!user) {
      return guestStorage.delete(tableName, id);
    }
    
    // 登录模式：使用 Supabase
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);
    
    if (error) throw error;
    return true;
  }
};

/**
 * 用户信息操作
 */
export const dbUser = {
  // 获取当前用户信息（从 Supabase Auth 和 profiles 表）
  async me() {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error('User not authenticated');
    }
    
    // 尝试从 profiles 表获取额外信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    // 合并数据
    return {
      ...authUser,
      ...(profile || {}),
      id: authUser.id,
      email: authUser.email,
      full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email,
      // 添加默认值以兼容现有代码
      streakCount: profile?.streak_count || 0,
      longestStreak: profile?.longest_streak || 0,
      freezeTokenCount: profile?.freeze_token_count || 0,
      restDays: profile?.rest_days || [],
      lastClearDate: profile?.last_clear_date || null,
      nextDayPlannedQuests: profile?.next_day_planned_quests || [],
      lastPlannedDate: profile?.last_planned_date || null,
      unlockedMilestones: profile?.unlocked_milestones || [],
      title: profile?.title || null,
      chestOpenCounter: profile?.chest_open_counter || 0,
      streakManuallyReset: profile?.streak_manually_reset || false
    };
  },

  // 更新用户信息
  async updateMe(updates) {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error('User not authenticated');
    }
    
    // 映射字段名从 camelCase 到 snake_case
    const mappedUpdates = {
      streak_count: updates.streakCount,
      longest_streak: updates.longestStreak,
      freeze_token_count: updates.freezeTokenCount,
      rest_days: updates.restDays,
      last_clear_date: updates.lastClearDate,
      next_day_planned_quests: updates.nextDayPlannedQuests,
      last_planned_date: updates.lastPlannedDate,
      unlocked_milestones: updates.unlockedMilestones,
      title: updates.title,
      chest_open_counter: updates.chestOpenCounter,
      streak_manually_reset: updates.streakManuallyReset,
      full_name: updates.full_name || updates.fullName
    };
    
    // 移除 undefined 值
    Object.keys(mappedUpdates).forEach(key => {
      if (mappedUpdates[key] === undefined) {
        delete mappedUpdates[key];
      }
    });
    
    // 更新或插入 profile
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.id,
        ...mappedUpdates,
        updated_date: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // 返回合并后的用户数据
    return {
      ...authUser,
      ...data,
      id: authUser.id,
      email: authUser.email
    };
  }
};



