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
    try {
      const fullUser = await dbUser.me();
      return fullUser;
    } catch (error) {
      // 如果用户未登录，返回 null（游客模式）
      if (error.message === 'User not authenticated') {
        return null;
      }
      throw error;
    }
  };

  useEffect(() => {
    checkAuthState();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // 登录时获取完整用户信息
        try {
          const fullUser = await fetchFullUser();
          setUser(fullUser);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          setAuthError(null);
          
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
          console.error('Failed to fetch full user:', error);
          setUser(session.user); // 降级到基础用户信息
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setMigrationPrompt(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token 刷新时也刷新用户信息
        try {
          const fullUser = await fetchFullUser();
          setUser(fullUser);
        } catch (error) {
          console.error('Failed to refresh user:', error);
          setUser(session.user);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthState = async () => {
    try {
      console.log('[AuthContext] 开始检查认证状态');
      setIsLoadingAuth(true);
      setAuthError(null);
      
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      console.log('[AuthContext] getUser 结果:', {
        hasUser: !!authUser,
        userId: authUser?.id || null,
        error: error?.message || null
      });
      
      if (error) {
        console.error('[AuthContext] Auth check failed:', error);
        setUser(null);
        setIsAuthenticated(false);
        if (error.message.includes('JWT')) {
          setAuthError({
            type: 'auth_required',
            message: 'Authentication required'
          });
        }
        console.log('[AuthContext] 设置 isLoadingAuth = false (错误情况)');
        setIsLoadingAuth(false);
      } else if (authUser) {
        // 获取完整用户信息
        try {
          console.log('[AuthContext] 开始获取完整用户信息');
          const fullUser = await fetchFullUser();
          console.log('[AuthContext] 获取完整用户信息成功:', {
            userId: fullUser?.id || null,
            hasStreakCount: fullUser?.streakCount !== undefined
          });
          setUser(fullUser);
          setIsAuthenticated(true);
          console.log('[AuthContext] 设置 isLoadingAuth = false (成功获取用户)');
          setIsLoadingAuth(false);
        } catch (error) {
          console.error('[AuthContext] Failed to fetch full user:', error);
          // 降级到基础用户信息
          setUser(authUser);
          setIsAuthenticated(true);
          console.log('[AuthContext] 设置 isLoadingAuth = false (降级到基础用户)');
          setIsLoadingAuth(false);
        }
      } else {
        console.log('[AuthContext] 无用户，设置为游客模式');
        setUser(null);
        setIsAuthenticated(false);
        console.log('[AuthContext] 设置 isLoadingAuth = false (游客模式)');
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('[AuthContext] Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      console.log('[AuthContext] 设置 isLoadingAuth = false (异常情况)');
      setIsLoadingAuth(false);
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
