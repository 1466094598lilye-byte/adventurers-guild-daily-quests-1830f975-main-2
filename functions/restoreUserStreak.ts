import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 验证用户
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取今天的日期（格式：yyyy-MM-dd）
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 获取昨天的日期
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 恢复连胜到13天（从截图看到的最长连胜）
    // 并补偿3个freeze tokens作为道歉
    // 🔥 关键修复：同时设置 lastClearDate 为昨天，这样今天就不会触发连胜中断警告
    await base44.auth.updateMe({
      streakCount: 13,
      longestStreak: 13,
      freezeTokenCount: 3,
      lastClearDate: yesterdayStr  // 设置为昨天，表示昨天已完成所有任务
    });

    return Response.json({ 
      success: true,
      message: '已成功恢复连胜到13天，并补偿3个freeze tokens！lastClearDate已设置为昨天。'
    });
  } catch (error) {
    console.error('恢复失败:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});