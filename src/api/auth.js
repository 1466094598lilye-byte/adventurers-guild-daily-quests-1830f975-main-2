// Supabase 认证 API 包装器
import { supabase } from '@/lib/supabase';
import { dbUser } from '@/lib/db';

export const auth = {
  // 获取当前用户
  // ⚠️ 注意：此函数需要先获取 authUser，然后传入 dbUser.me()
  async me() {
    // 🔥 在 auth.js 中，我们需要先获取 authUser，然后传入
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) {
      return null;
    }
    // 🔥 传入 authUser，禁止 dbUser.me() 内部调用 getUser
    return dbUser.me(authUser);
  },

  // 更新用户信息
  async updateMe(updates) {
    return dbUser.updateMe(updates);
  },

  // Google 登录
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`
      }
    });
    if (error) throw error;
    return data;
  },

  // 登出
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  },

  // 重定向到登录（兼容 Base44）
  redirectToLogin(redirectUrl) {
    this.signInWithGoogle().catch(console.error);
  }
};

// 导出为默认对象以保持兼容性
export default auth;



