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
// 使用 getUser() 确保获取到有效的用户，避免 session 缓存不一致的问题
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
    // 使用 getUser() 确保获取到有效的用户，避免 session 缓存不一致的问题
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
  // ⚠️ 重要：此函数禁止内部调用 supabase.auth.getUser()，必须从外部传入 authUser
  // 参数：authUser - 从 supabase.auth.getUser() 获取的用户对象（必需）
  async me(authUser = null) {
    // 🔥 最外层 try/catch，确保永远 resolve
    try {
      console.log('[dbUser.me] 开始获取用户信息');
      
      // 🔥 禁止内部调用 getUser，必须从外部传入
      if (!authUser) {
        console.warn('[dbUser.me] 未传入 authUser，返回 null');
        return null;
      }
      
      console.log('[dbUser.me] Auth 用户已传入:', authUser.id);
      
      // 🔥 使用 maybeSingle() 而不是 single()，避免 Promise 挂起
      // 🔥 添加超时保护，确保查询不会永久 pending
      console.log('[dbUser.me] 开始查询 profiles 表');
      
      const profileQueryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      
      // 添加超时保护（5秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile query timeout')), 5000);
      });
      
      let profile = null;
      let profileError = null;
      
      try {
        const result = await Promise.race([profileQueryPromise, timeoutPromise]);
        // Promise.race 的结果：
        // - 如果查询成功：result = { data: {...} 或 null, error: null }
        // - 如果查询失败：result = { data: null, error: {...} }
        // - 如果超时：会被 catch 捕获
        if (result) {
          if (result.error) {
            profileError = result.error;
          } else {
            // result.data 可能是 null（没有找到记录），这是正常的，不是错误
            profile = result.data; // 可能是 null，这是正常的
          }
        }
      } catch (error) {
        // 超时或其他错误
        if (error.message === 'Profile query timeout') {
          console.warn('[dbUser.me] Profile 查询超时（5秒），使用基础用户信息');
        } else {
          console.warn('[dbUser.me] Profile 查询异常:', {
            message: error.message,
            isTimeout: error.message === 'Profile query timeout'
          });
        }
        profileError = error;
      }
      
      // 🔥 无论 profile 是否存在，都必须返回结果
      if (profileError) {
        console.warn('[dbUser.me] Profile 查询失败，使用基础用户信息:', {
          error: profileError.message,
          code: profileError.code,
          details: profileError.details
        });
        // 返回基础用户信息，而不是抛出错误
        return {
          ...authUser,
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email,
          // 添加默认值以兼容现有代码
          streakCount: 0,
          longestStreak: 0,
          freezeTokenCount: 0,
          restDays: [],
          lastClearDate: null,
          nextDayPlannedQuests: [],
          lastPlannedDate: null,
          unlockedMilestones: [],
          title: null,
          chestOpenCounter: 0,
          streakManuallyReset: false
        };
      }
      
      console.log('[dbUser.me] Profile 查询成功，合并数据');
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
    } catch (error) {
      // 🔥 最外层 catch，确保永远 resolve
      console.error('[dbUser.me] 最外层异常捕获:', {
        message: error.message,
        stack: error.stack
      });
      // 如果有 authUser，返回基础用户信息；否则返回 null
      if (authUser) {
        console.log('[dbUser.me] 异常情况下返回基础用户信息');
        return {
          ...authUser,
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email,
          streakCount: 0,
          longestStreak: 0,
          freezeTokenCount: 0,
          restDays: [],
          lastClearDate: null,
          nextDayPlannedQuests: [],
          lastPlannedDate: null,
          unlockedMilestones: [],
          title: null,
          chestOpenCounter: 0,
          streakManuallyReset: false
        };
      }
      console.log('[dbUser.me] 异常情况下返回 null');
      return null;
    }
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



