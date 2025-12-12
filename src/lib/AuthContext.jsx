import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from './supabase';
import { dbUser } from './db';
import { hasGuestData, migrateGuestData } from './guestDataMigration';
import MigrationDialog from '@/components/MigrationDialog';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [migrationPrompt, setMigrationPrompt] = useState(null);

  // 获取完整用户信息（包含应用特定字段）
  const fetchFullUser = async () => {
    console.log('[AuthContext] fetchFullUser 调用前');
    try {
      console.log('[AuthContext] 调用 dbUser.me()');
      const fullUser = await dbUser.me();
      console.log('[AuthContext] dbUser.me() 成功返回:', {
        userId: fullUser?.id || null,
        email: fullUser?.email || null,
        hasProfile: !!fullUser?.streakCount
      });
      return fullUser;
    } catch (error) {
      console.error('[AuthContext] fetchFullUser 错误:', {
        message: error.message,
        stack: error.stack
      });
      // 如果用户未登录，返回 null（游客模式）
      if (error.message === 'User not authenticated') {
        console.log('[AuthContext] 用户未认证，返回 null');
        return null;
      }
      // 如果是 profile 查询失败，返回基础用户信息而不是抛出错误
      if (error.message?.includes('profiles') || error.code === 'PGRST301') {
        console.log('[AuthContext] Profile 查询失败，降级到基础用户信息');
        // 尝试获取基础用户信息
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          return {
            ...authUser,
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
      }
      throw error;
    }
  };

  useEffect(() => {
    console.log('[AuthContext] useEffect 初始化，调用 checkAuthState');
    checkAuthState();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] onAuthStateChange 触发:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id || null
      });
      
      if (event === 'SIGNED_IN' && session) {
        console.log('[AuthContext] SIGNED_IN 事件处理开始');
        // 登录时获取完整用户信息
        try {
          console.log('[AuthContext] SIGNED_IN: 开始获取完整用户信息');
          setIsLoadingAuth(true); // 确保在获取用户信息时显示加载状态
          const fullUser = await fetchFullUser();
          console.log('[AuthContext] SIGNED_IN: 获取完整用户信息成功，设置状态');
          setUser(fullUser);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setAuthError(null);
          console.log('[AuthContext] SIGNED_IN: 状态设置完成，isLoadingAuth = false');
          
          // 检查是否有游客数据需要迁移
          if (hasGuestData()) {
            setMigrationPrompt({
              show: true,
              onMigrate: async () => {
                try {
                  const result = await migrateGuestData({ merge: true, skipExisting: false });
                  if (result.success) {
                    setMigrationPrompt(null);
                    // 刷新用户数据
                    await refreshUser();
                    // 刷新页面数据
                    window.location.reload();
                  } else {
                    alert('数据迁移失败，请重试');
                  }
                } catch (error) {
                  console.error('Migration error:', error);
                  alert('数据迁移失败：' + error.message);
                }
              },
              onSkip: () => {
                setMigrationPrompt(null);
              }
            });
          }
        } catch (error) {
          console.error('[AuthContext] SIGNED_IN: Failed to fetch full user:', error);
          console.log('[AuthContext] SIGNED_IN: 降级到基础用户信息');
          setUser(session.user); // 降级到基础用户信息
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setAuthError(null);
          console.log('[AuthContext] SIGNED_IN: 降级完成，isLoadingAuth = false');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthContext] SIGNED_OUT 事件处理');
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setMigrationPrompt(null);
        console.log('[AuthContext] SIGNED_OUT: 状态已清除，isLoadingAuth = false');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('[AuthContext] TOKEN_REFRESHED 事件处理');
        // Token 刷新时也刷新用户信息
        try {
          const fullUser = await fetchFullUser();
          setUser(fullUser);
          console.log('[AuthContext] TOKEN_REFRESHED: 用户信息已刷新');
        } catch (error) {
          console.error('[AuthContext] TOKEN_REFRESHED: Failed to refresh user:', error);
          setUser(session.user);
        }
      } else {
        console.log('[AuthContext] 其他事件:', event);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('[AuthContext] ========== checkAuthState 开始 ==========');
      console.log('[AuthContext] 步骤1: 设置 isLoadingAuth = true');
      setIsLoadingAuth(true);
      setAuthError(null);
      
      console.log('[AuthContext] 步骤2: 调用 supabase.auth.getUser()');
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      console.log('[AuthContext] 步骤3: getUser 返回结果:', {
        hasUser: !!authUser,
        userId: authUser?.id || null,
        userEmail: authUser?.email || null,
        error: error?.message || null,
        errorCode: error?.status || null
      });
      
      if (error) {
        console.error('[AuthContext] 步骤4: Auth check failed:', error);
        console.log('[AuthContext] 步骤5: 设置用户为 null，isAuthenticated = false');
        setUser(null);
        setIsAuthenticated(false);
        if (error.message.includes('JWT')) {
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required'
          });
        }
        console.log('[AuthContext] 步骤6: 设置 isLoadingAuth = false (错误情况)');
        setIsLoadingAuth(false);
        console.log('[AuthContext] ========== checkAuthState 完成 (错误分支) ==========');
      } else if (authUser) {
        // 获取完整用户信息
        try {
          console.log('[AuthContext] 步骤4: 有用户，开始获取完整用户信息');
          console.log('[AuthContext] 步骤5: 调用 fetchFullUser()');
          const fullUser = await fetchFullUser();
          console.log('[AuthContext] 步骤6: fetchFullUser() 返回:', {
            userId: fullUser?.id || null,
            hasStreakCount: fullUser?.streakCount !== undefined,
            email: fullUser?.email || null
          });
          console.log('[AuthContext] 步骤7: 设置用户和认证状态');
          setUser(fullUser);
          setIsAuthenticated(true);
          console.log('[AuthContext] 步骤8: 设置 isLoadingAuth = false (成功获取用户)');
          setIsLoadingAuth(false);
          console.log('[AuthContext] ========== checkAuthState 完成 (成功分支) ==========');
        } catch (error) {
          console.error('[AuthContext] 步骤6: Failed to fetch full user:', {
            message: error.message,
            code: error.code,
            details: error.details
          });
          console.log('[AuthContext] 步骤7: 降级到基础用户信息');
          // 降级到基础用户信息
          setUser(authUser);
          setIsAuthenticated(true);
          console.log('[AuthContext] 步骤8: 设置 isLoadingAuth = false (降级到基础用户)');
          setIsLoadingAuth(false);
          console.log('[AuthContext] ========== checkAuthState 完成 (降级分支) ==========');
        }
      } else {
        console.log('[AuthContext] 步骤4: 无用户，设置为游客模式');
        setUser(null);
        setIsAuthenticated(false);
        console.log('[AuthContext] 步骤5: 设置 isLoadingAuth = false (游客模式)');
        setIsLoadingAuth(false);
        console.log('[AuthContext] ========== checkAuthState 完成 (游客分支) ==========');
      }
    } catch (error) {
      console.error('[AuthContext] ========== checkAuthState 异常 ==========');
      console.error('[AuthContext] Unexpected error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      console.log('[AuthContext] 设置 isLoadingAuth = false (异常情况)');
      setIsLoadingAuth(false);
      console.log('[AuthContext] ========== checkAuthState 完成 (异常分支) ==========');
    }
  };

  // 刷新用户信息（用于更新用户数据后）
  const refreshUser = async () => {
    if (!isAuthenticated) return;
    try {
      const fullUser = await fetchFullUser();
      setUser(fullUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      
      if (shouldRedirect) {
        window.location.href = window.location.pathname;
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigateToLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });
      
      if (error) {
        console.error('Login redirect failed:', error);
        setAuthError({
          type: 'auth_required',
          message: 'Failed to redirect to login'
        });
      }
    } catch (error) {
      console.error('Login navigation failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      logout,
      navigateToLogin,
      refreshUser,
      migrationPrompt,
      setMigrationPrompt
    }}>
      {children}
      {migrationPrompt?.show && <MigrationDialog prompt={migrationPrompt} />}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
