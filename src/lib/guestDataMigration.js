/**
 * 游客数据迁移工具
 * 将 localStorage 中的游客数据迁移到 Supabase
 */

import { guestStorage } from './guestStorage';
import { supabase } from './supabase';
import { base44 } from '@/api/base44Client';

// 需要迁移的表（包括大项目）
const TABLES_TO_MIGRATE = ['quests', 'loot', 'daily_chests', 'long_term_projects'];

/**
 * 检查是否有游客数据需要迁移
 */
export const hasGuestData = () => {
  try {
    for (const tableName of TABLES_TO_MIGRATE) {
      const data = guestStorage.list(tableName);
      if (data.length > 0) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking guest data:', error);
    return false;
  }
};

/**
 * 获取游客数据统计
 */
export const getGuestDataStats = () => {
  try {
    const stats = {};
    for (const tableName of TABLES_TO_MIGRATE) {
      const data = guestStorage.list(tableName);
      stats[tableName] = data.length;
    }
    return stats;
  } catch (error) {
    console.error('Error getting guest data stats:', error);
    return {};
  }
};

/**
 * 迁移游客数据到 Supabase
 * @param {Object} options - 迁移选项
 * @param {boolean} options.merge - 是否合并数据（如果用户已有数据）
 * @param {boolean} options.skipExisting - 是否跳过已存在的记录
 */
export const migrateGuestData = async (options = {}) => {
  const { merge = true, skipExisting = false } = options;
  
  try {
    // 获取当前用户
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      throw new Error('User not authenticated');
    }

    const migrationResults = {
      success: true,
      migrated: {},
      errors: [],
      skipped: {}
    };

    // 迁移每个表的数据
    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        const guestData = guestStorage.list(tableName);
        
        if (guestData.length === 0) {
          migrationResults.migrated[tableName] = 0;
          continue;
        }

        let migratedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const item of guestData) {
          try {
            // 检查是否已存在（如果 skipExisting 为 true）
            if (skipExisting) {
              const existing = await supabase
                .from(tableName)
                .select('id')
                .eq('owner_id', authUser.id)
                .eq('id', item.id)
                .single();
              
              if (existing.data) {
                skippedCount++;
                continue;
              }
            }

            // 准备迁移数据
            // 注意：保持原始 ID，但确保 owner_id 正确设置
            // 如果 ID 冲突，Supabase 会报错，我们会在错误处理中处理
            // 强制设置 owner_id 为当前用户 ID，覆盖任何传入的 owner_id
            const migrationData = {
              ...item,
              owner_id: authUser.id, // 强制设置为当前用户 ID，确保 RLS 策略通过
              // 保持原始 ID，让 Supabase 处理冲突
            };

            // 对于 quests，需要加密 title 和 actionHint
            if (tableName === 'quests' && (migrationData.title || migrationData.actionHint)) {
              try {
                const { data: encrypted } = await base44.functions.invoke('encryptQuestData', {
                  title: migrationData.title || '',
                  actionHint: migrationData.actionHint || ''
                });
                
                if (encrypted) {
                  migrationData.title = encrypted.encryptedTitle;
                  migrationData.actionHint = encrypted.encryptedActionHint;
                }
              } catch (encryptError) {
                console.warn('Failed to encrypt quest data, using plain text:', encryptError);
                // 如果加密失败，继续使用明文（不推荐，但至少数据不会丢失）
              }
            }
            
            // 对于 long_term_projects，需要加密 projectName 和 description
            if (tableName === 'long_term_projects' && (migrationData.projectName || migrationData.description)) {
              try {
                const { data: encrypted } = await base44.functions.invoke('encryptProjectData', {
                  projectName: migrationData.projectName || '',
                  description: migrationData.description || ''
                });
                
                if (encrypted) {
                  migrationData.projectName = encrypted.encryptedProjectName;
                  migrationData.description = encrypted.encryptedDescription;
                }
              } catch (encryptError) {
                console.warn('Failed to encrypt project data, using plain text:', encryptError);
                // 如果加密失败，继续使用明文（不推荐，但至少数据不会丢失）
              }
            }

            // 插入数据到 Supabase
            // 如果 ID 以 guest_ 开头，让 Supabase 自动生成新 ID
            const insertData = { 
              ...migrationData,
              owner_id: authUser.id // 再次确保 owner_id 正确设置，防止被覆盖
            };
            if (insertData.id && insertData.id.startsWith('guest_')) {
              delete insertData.id; // 让 Supabase 自动生成新 ID
            }
            
            const { data: inserted, error: insertError } = await supabase
              .from(tableName)
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              // 如果是唯一约束冲突且 merge 为 true，尝试更新
              if (insertError.code === '23505' && merge) {
                // 先尝试查找现有记录
                const { data: existing } = await supabase
                  .from(tableName)
                  .select('id')
                  .eq('owner_id', authUser.id)
                  .eq('id', item.id)
                  .single();
                
                if (existing) {
                  // 更新现有记录
                  const { error: updateError } = await supabase
                    .from(tableName)
                    .update(insertData)
                    .eq('id', item.id)
                    .eq('owner_id', authUser.id);
                  
                  if (updateError) {
                    errors.push(`Failed to update ${item.id}: ${updateError.message}`);
                  } else {
                    migratedCount++;
                  }
                } else {
                  // 如果找不到，可能是其他唯一约束冲突，跳过
                  skippedCount++;
                  errors.push(`Skipped ${item.id}: unique constraint conflict`);
                }
              } else {
                // 如果 skipExisting 为 true，跳过错误
                if (skipExisting && insertError.code === '23505') {
                  skippedCount++;
                } else {
                  errors.push(`Failed to insert ${item.id}: ${insertError.message}`);
                }
              }
            } else {
              migratedCount++;
            }
          } catch (itemError) {
            errors.push(`Error migrating item ${item.id}: ${itemError.message}`);
          }
        }

        migrationResults.migrated[tableName] = migratedCount;
        migrationResults.skipped[tableName] = skippedCount;
        
        if (errors.length > 0) {
          migrationResults.errors.push({
            table: tableName,
            errors
          });
        }
      } catch (tableError) {
        migrationResults.errors.push({
          table: tableName,
          errors: [tableError.message]
        });
        migrationResults.success = false;
      }
    }

    // 如果迁移成功，清理游客数据
    if (migrationResults.success && migrationResults.errors.length === 0) {
      guestStorage.clear();
    }

    return migrationResults;
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      migrated: {},
      errors: [{ table: 'general', errors: [error.message] }],
      skipped: {}
    };
  }
};

/**
 * 清理游客数据（不迁移）
 */
export const clearGuestData = () => {
  try {
    guestStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing guest data:', error);
    return false;
  }
};

