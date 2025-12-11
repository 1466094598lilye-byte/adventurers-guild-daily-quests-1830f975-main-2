import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * 清理已完成超过2年的大项目记录及其关联任务
 * 
 * 安全机制：只删除当前用户自己创建的项目
 * 建议：每周运行一次
 */
Deno.serve(async (req) => {
  try {
    // 1. 创建 Base44 客户端并进行用户认证
    const base44 = createClientFromRequest(req);
    
    console.log('=== 开始清理旧的大项目记录 ===');
    console.log('执行时间:', new Date().toISOString());
    
    // 2. 验证用户身份
    let user;
    try {
      user = await base44.auth.me();
    } catch (error) {
      console.error('用户认证失败:', error.message);
      return Response.json({
        success: false,
        error: 'Unauthorized: Authentication required',
        message: '需要登录才能执行清理操作'
      }, { status: 401 });
    }
    
    console.log('✅ 用户认证通过:', user.email);
    
    // 3. 计算"2年前"的日期（730天）
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setDate(twoYearsAgo.getDate() - 730); // 2年 = 730天
    
    // 格式化为 yyyy-MM-dd
    const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0];
    
    console.log('📅 当前日期:', now.toISOString().split('T')[0]);
    console.log('📅 2年前日期:', twoYearsAgoStr);
    console.log('🔍 将删除所有 completionDate < ' + twoYearsAgoStr + ' 的项目');
    
    // 4. 查询需要删除的项目（使用用户身份查询，自动遵守 RLS）
    console.log('');
    console.log('📊 第一步：查询符合条件的大项目...');
    
    let oldProjects = [];
    try {
      // 使用用户身份查询（会自动只返回用户自己的项目）
      const allProjects = await base44.entities.LongTermProject.list();
      
      console.log('✅ 查询到用户的所有项目数量:', allProjects.length);
      
      // 在内存中过滤出已完成且超过2年的项目
      oldProjects = allProjects.filter(project => {
        const status = project.status;
        const completionDate = project.completionDate;
        
        // 必须是已完成状态
        if (status !== 'completed') {
          return false;
        }
        
        // 必须有完成日期
        if (!completionDate) {
          return false;
        }
        
        // 检查是否超过2年
        return completionDate < twoYearsAgoStr;
      });
      
      console.log('🎯 符合删除条件的项目数量:', oldProjects.length);
      
      if (oldProjects.length > 0) {
        console.log('');
        console.log('📋 需要删除的项目列表：');
        oldProjects.forEach((project, index) => {
          console.log(`  ${index + 1}. ${project.projectName} (完成于: ${project.completionDate}, ID: ${project.id})`);
        });
      } else {
        console.log('✅ 没有找到需要删除的项目！');
        
        return Response.json({
          success: true,
          message: '没有找到需要删除的项目',
          executedBy: user.email,
          executedAt: now.toISOString(),
          cutoffDate: twoYearsAgoStr,
          foundProjects: [],
          stats: {
            projectsFound: 0,
            projectsDeleted: 0,
            questsDeleted: 0
          }
        });
      }
      
    } catch (error) {
      console.error('❌ 查询项目失败:', error.message);
      throw new Error('查询大项目记录失败: ' + error.message);
    }
    
    // 5. 删除关联的任务
    console.log('');
    console.log('📊 第二步：删除关联的任务...');
    
    let totalQuestsDeleted = 0;
    
    for (const project of oldProjects) {
      console.log('');
      console.log(`🔍 处理项目: ${project.projectName} (ID: ${project.id})`);
      
      try {
        // 查询该项目的所有关联任务
        const allQuests = await base44.entities.Quest.list();
        const relatedQuests = allQuests.filter(q => q.longTermProjectId === project.id);
        
        console.log(`  ├─ 找到 ${relatedQuests.length} 个关联任务`);
        
        if (relatedQuests.length > 0) {
          // 逐个删除任务
          for (const quest of relatedQuests) {
            try {
              await base44.entities.Quest.delete(quest.id);
              totalQuestsDeleted++;
              console.log(`  ├─ ✅ 删除任务: ${quest.title || quest.actionHint || '未命名'}`);
            } catch (deleteError) {
              console.error(`  ├─ ❌ 删除任务失败 (ID: ${quest.id}):`, deleteError.message);
            }
          }
        }
        
      } catch (error) {
        console.error(`  └─ ❌ 查询关联任务失败:`, error.message);
      }
    }
    
    console.log('');
    console.log(`✅ 共删除 ${totalQuestsDeleted} 个关联任务`);
    
    // 6. 删除项目本身
    console.log('');
    console.log('📊 第三步：删除大项目记录...');
    
    let projectsDeleted = 0;
    const deletedProjects = [];
    const failedProjects = [];
    
    for (const project of oldProjects) {
      try {
        await base44.entities.LongTermProject.delete(project.id);
        projectsDeleted++;
        deletedProjects.push({
          id: project.id,
          name: project.projectName,
          completionDate: project.completionDate
        });
        console.log(`✅ 删除项目: ${project.projectName} (ID: ${project.id})`);
      } catch (error) {
        console.error(`❌ 删除项目失败 (${project.projectName}):`, error.message);
        failedProjects.push({
          id: project.id,
          name: project.projectName,
          error: error.message
        });
      }
    }
    
    console.log('');
    console.log('=== 清理完成 ===');
    console.log(`📊 项目删除成功: ${projectsDeleted}/${oldProjects.length}`);
    console.log(`📊 任务删除成功: ${totalQuestsDeleted}`);
    
    // 7. 返回成功响应
    return Response.json({
      success: true,
      message: `成功删除 ${projectsDeleted} 个大项目和 ${totalQuestsDeleted} 个关联任务`,
      executedBy: user.email,
      executedAt: now.toISOString(),
      cutoffDate: twoYearsAgoStr,
      deletedProjects,
      failedProjects: failedProjects.length > 0 ? failedProjects : undefined,
      stats: {
        projectsFound: oldProjects.length,
        projectsDeleted,
        questsDeleted: totalQuestsDeleted
      }
    });
    
  } catch (error) {
    console.error('❌ 清理操作执行失败:', error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      message: '清理操作执行过程中发生错误',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});